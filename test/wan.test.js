import test from "node:test";
import assert from "node:assert/strict";
import {buildWanWorkflow,selectWanModels} from "../server/wan.js";
const models={unet:"wan2.2_ti2v_5B_fp16.safetensors",clip:"umt5_xxl_fp8.safetensors",vae:"wan2.2_vae.safetensors"};
test("builds connected image-to-video graph with distinct prompts",()=>{
 const a=buildWanWorkflow({...models,image:"a.png",prompt:"walk"});
 const b=buildWanWorkflow({...models,image:"b.png",prompt:"sit"});
 assert.equal(a["4"].inputs.text,"walk");
 assert.equal(b["4"].inputs.text,"sit");
 assert.equal(a["6"].inputs.image,"a.png");
 assert.deepEqual(a["7"].inputs.start_image,["6",0]);
 assert.equal(a["7"].inputs.length,121);
 assert.equal(a["11"].inputs.fps,24);
 for(const node of Object.values(a)) for(const v of Object.values(node.inputs)) if(Array.isArray(v)) assert.ok(a[v[0]]);
});
test("rejects missing models",()=>assert.throws(()=>selectWanModels({}),/missing/i));
test("selects compatible model names",()=>{
 const entry=(key,value)=>({input:{required:{[key]:[[value]]}}});
 assert.deepEqual(selectWanModels({UNETLoader:entry("unet_name",models.unet),CLIPLoader:entry("clip_name",models.clip),VAELoader:entry("vae_name",models.vae)}),models);
});
