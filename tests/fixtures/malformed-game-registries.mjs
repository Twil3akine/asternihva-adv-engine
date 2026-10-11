export const malformedGameFields = [
  {title:123}, {scenario:null}, {scenario:[]},
  ...['id','title','chapter','description'].map(key=>({scenario:{[key]:{}}})),
  ...[NaN,Infinity,'1',null].map(order=>({scenario:{order}})),
  {audioAssets:null}, {audioAssets:[]}, {audioAssets:{track:123}},
  {backgrounds:null}, {backgrounds:[]}, {backgrounds:{room:null}}, {backgrounds:{room:{src:123}}},
  {backgrounds:{room:{src:'room.svg',anchorX:-.1}}},
  {backgrounds:{room:{src:'room.svg',anchorY:1.1}}},
  {backgrounds:{room:{src:'room.svg',overlay:Infinity}}},
  {backgrounds:{room:{src:'room.svg',overlay:'0.5'}}},
  {stageLayouts:null}, {stageLayouts:[]}, {stageLayouts:{solo:null}},
  {stageLayouts:{solo:{}}}, {stageLayouts:{solo:{members:{}}}},
  {stageLayouts:{solo:{members:[null]}}}, {stageLayouts:{solo:{members:[{character:1}]}}},
];
