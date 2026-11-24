import * as esbuild from "esbuild";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
const root=new URL("../",import.meta.url);
export async function buildArcadeEngine(){
 await esbuild.build({stdin:{contents:'export * from "./arcade/vendor/model/spin.ts";export * from "./arcade/vendor/model/geometry.ts";',resolveDir:fileURLToPath(root)},bundle:true,format:"esm",target:"es2022",outfile:fileURLToPath(new URL("arcade/checks/engine.mjs",root))});
}
export async function buildArcadePages(){
 const app=await esbuild.build({entryPoints:[fileURLToPath(new URL("arcade/src/app.mjs",root))],bundle:true,write:false,format:"iife",target:"es2022",charset:"ascii"});
 const font=(await readFile(new URL("assets/Nunito.ttf",root))).toString("base64");
 const license=await readFile(new URL("assets/Nunito-OFL.txt",root),"utf8");
 const css=(await readFile(new URL("arcade/src/style.css",root),"utf8")).replace("__FONT__","data:font/ttf;base64,"+font)+"\n/* Nunito OFL\n"+license+"\n*/";
 const html=(await readFile(new URL("arcade/src/page.html",root),"utf8")).replace("__CSS__",()=>css).replace("__APP__",()=>app.outputFiles[0].text.replace(/<\/script/gi,"<\\/script"));
 const output=new URL("dist/demos/arcade/",root);await mkdir(output,{recursive:true});
 await writeFile(new URL("index.html",output),html);await writeFile(new URL("Nunito-OFL.txt",output),license);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){if(process.argv.includes("--engine"))await buildArcadeEngine();else await buildArcadePages();}
