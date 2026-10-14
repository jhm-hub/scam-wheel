import Peer, { type DataConnection } from 'peerjs';
import { proof, randomKey, roomId, validKey, verifyProof } from './protocol.js';

export type RoomStatus = 'connecting' | 'waiting' | 'connected' | 'offline' | 'duplicate';
export interface RoomOptions {
    role: 'viewer' | 'controls'; key: string;
    status(value: RoomStatus): void;
    message(data: unknown): void;
    ready?(): void;
}

export function connectRoom(options: RoomOptions) {
    let peer: Peer | undefined, disposed = false, target = '', connecting = false;
    const trusted = new Set<DataConnection>(), connections = new Set<DataConnection>();
    let retry: ReturnType<typeof setTimeout> | undefined;
    function broadcast(data: unknown): boolean {
        let sent = false;
        for (const connection of trusted) if (connection.open) { connection.send(data); sent = true; }
        return sent;
    }
    function schedule() {
        if (disposed || retry) return;
        retry = setTimeout(() => { retry = undefined; if (!peer || peer.destroyed) start(); else if (peer.disconnected) peer.reconnect(); else dial(); }, 3000);
    }
    function wire(connection: DataConnection) {
        connections.add(connection);
        const nonce = randomKey();
        let authenticated = false, answered = false, closed = false, lastTraffic = Date.now(), chain = Promise.resolve();
        const cleanup = () => {
            if (closed) return;
            closed = true; clearTimeout(timeout); clearInterval(heartbeat); trusted.delete(connection); connections.delete(connection); connecting = false;
            if (!disposed && !trusted.size) { options.status('waiting'); schedule(); }
        };
        const end = () => { cleanup(); connection.close(); };
        // PeerJS does not emit close when a channel times out before opening.
        const timeout = setTimeout(() => { if (!authenticated) end(); }, 12000);
        const heartbeat = setInterval(() => {
            if (!authenticated || closed) return;
            if (Date.now() - lastTraffic > 10000 || !connection.open) end();
            else connection.send({ kind: 'ping' });
        }, 2000);
        const localChallenge = () => 'scam-room-v1:' + nonce + ':' + peer!.id + ':' + connection.peer;
        connection.on('open', () => connection.send({ kind: 'hello', nonce }));
        connection.on('data', raw => {
            chain = chain.then(async () => {
                if (closed || !raw || typeof raw !== 'object' || JSON.stringify(raw).length > 100000) return;
                const data = raw as Record<string, unknown>;
                lastTraffic = Date.now();
                if (data.kind === 'hello' && validKey(data.nonce) && !answered) {
                    answered = true;
                    const signature = await proof(options.key, 'scam-room-v1:' + data.nonce + ':' + connection.peer + ':' + peer!.id);
                    if (connection.open) connection.send({ kind: 'proof', signature });
                } else if (data.kind === 'proof' && !authenticated) {
                    if (!await verifyProof(options.key, localChallenge(), data.signature)) { end(); return; }
                    if (closed || !connection.open) return;
                    authenticated = true; clearTimeout(timeout); trusted.add(connection); options.status('connected');
                    connection.send({ kind: 'ready' });
                } else if (authenticated && data.kind === 'ready') options.ready?.();
                else if (authenticated && data.kind === 'ping') connection.send({ kind: 'pong' });
                else if (authenticated && data.kind === 'payload') options.message(data.value);
            }).catch(end);
        });
        connection.on('close', cleanup); connection.on('error', end);
    }
    function dial() {
        if (disposed || options.role !== 'controls' || !peer?.open || trusted.size || connecting) return;
        connecting = true;
        wire(peer.connect(target, { reliable: true, serialization: 'json' }));
    }
    function start() {
        if (disposed) return;
        options.status('connecting');
        peer = options.role === 'viewer' ? new Peer(target, { debug: 0 }) : new Peer({ debug: 0 });
        peer.on('open', () => { connecting = false; options.status('waiting'); if (options.role === 'viewer') options.ready?.(); else dial(); });
        peer.on('connection', connection => { if (options.role === 'viewer' && connections.size < 4) wire(connection); else connection.close(); });
        peer.on('disconnected', () => { options.status(trusted.size ? 'connected' : 'offline'); schedule(); });
        peer.on('error', error => {
            connecting = false;
            if (error.type === 'unavailable-id') { options.status('duplicate'); peer?.destroy(); }
            else options.status('offline');
            schedule();
        });
    }
    void roomId(options.key).then(id => { target = id; start(); });
    return {
        send(value: unknown) { return broadcast({ kind: 'payload', value }); },
        dispose() { disposed = true; if (retry) clearTimeout(retry); for (const connection of connections) connection.close(); peer?.destroy(); },
    };
}
