import * as esbuild from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
export async function buildTwistPages(){
  const app=await esbuild.build({entryPoints:[fileURLToPath(new URL('twists/src/app.mjs',root))],bundle:true,write:false,format:'iife',target:'es2022',charset:'ascii'});
  const font=(await readFile(new URL('assets/Nunito.ttf',root))).toString('base64');
  const license=await readFile(new URL('assets/Nunito-OFL.txt',root),'utf8');
  const css=(await readFile(new URL('twists/src/style.css',root),'utf8')).replace('__FONT__','data:font/ttf;base64,'+font);
  const html=(await readFile(new URL('twists/src/page.html',root),'utf8')).replace('__CSS__',()=>css).replace('__APP__',()=>app.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
  const output=new URL('dist/demos/twists/',root);await mkdir(output,{recursive:true});
  await writeFile(new URL('index.html',output),html);await writeFile(new URL('Nunito-OFL.txt',output),license);
  return {file:fileURLToPath(new URL('index.html',output)),bytes:Buffer.byteLength(html)};
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(await buildTwistPages());
