// Native ComfyUI Wan 2.2 TI2V 5B graph. Model names are selected from live node inventory.
export function buildWanWorkflow({image, prompt, unet, clip, vae, seed=42}) {
  if (![image,prompt,unet,clip,vae].every(v=>typeof v==="string"&&v.trim())) throw new Error("Missing Wan model or reference");
  const n=(class_type,inputs)=>({class_type,inputs});
  return {
    "1":n("UNETLoader",{unet_name:unet,weight_dtype:"default"}),
    "2":n("CLIPLoader",{clip_name:clip,type:"wan",device:"default"}),
    "3":n("VAELoader",{vae_name:vae}),
    "4":n("CLIPTextEncode",{clip:["2",0],text:prompt}),
    "5":n("CLIPTextEncode",{clip:["2",0],text:"static image, frozen pose, distorted face, flicker, text, watermark, extra limbs"}),
    "6":n("LoadImage",{image}),
    "7":n("Wan22ImageToVideoLatent",{vae:["3",0],start_image:["6",0],width:832,height:480,length:121,batch_size:1}),
    "8":n("ModelSamplingSD3",{model:["1",0],shift:8}),
    "9":n("KSampler",{model:["8",0],positive:["4",0],negative:["5",0],latent_image:["7",0],seed,steps:20,cfg:5,sampler_name:"uni_pc",scheduler:"simple",denoise:1}),
    "10":n("VAEDecode",{samples:["9",0],vae:["3",0]}),
    "11":n("CreateVideo",{images:["10",0],fps:24}),
    "12":n("SaveVideo",{video:["11",0],filename_prefix:"please-see-me/scene",format:"mp4",codec:"h264"})
  };
}
export function selectWanModels(nodes) {
  const choices=(node,key)=>nodes[node]?.input?.required?.[key]?.[0] || [];
  const pick=(node,key,re)=>choices(node,key).find(v=>typeof v==="string"&&re.test(v));
  const models={unet:pick("UNETLoader","unet_name",/wan.*2[._-]?2.*(?:ti2v|5b)/i),clip:pick("CLIPLoader","clip_name",/umt5.*xxl/i),vae:pick("VAELoader","vae_name",/wan.*2[._-]?2/i)};
  if(Object.values(models).some(v=>!v)) throw new Error("Wan 2.2 TI2V 5B, UMT5 XXL or Wan 2.2 VAE missing from ComfyUI");
  return models;
}

export function validateGraphInputs(graph,nodes) {
 for(const [id,node] of Object.entries(graph)) {
  const spec=nodes[node.class_type];
  if(!spec) throw new Error("Missing node "+node.class_type);
  const required=spec.input?.required||{};
  const allowed={...required,...spec.input?.optional};
  for(const key of Object.keys(required)) if(!(key in node.inputs)) throw new Error("Node "+id+" requires "+key);
  for(const [key,value] of Object.entries(node.inputs)) {
   if(!(key in allowed)) throw new Error("Node "+id+" does not accept "+key);
   const options=allowed[key][0];
   if(Array.isArray(options)&&!Array.isArray(value)&&!options.includes(value)&&node.class_type!=="LoadImage") throw new Error("Unsupported "+key+" on "+node.class_type+": "+value);
  }
 }
 return graph;
}
