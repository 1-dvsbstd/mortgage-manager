const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root=process.env.MM_MODEL_ROOT||'src';
const source=fs.readFileSync(root+'/app-runtime.js','utf8');
const declarations=['validMarketData','ltvBandFor','formatSourceDate','applyMarketRates'].map(name=>{
 const start=source.indexOf('  function '+name+'(');assert.ok(start>=0);
 const end=source.indexOf('\n  function ',start+3);return source.slice(start,end);
}).join('\n');
let state={homeValue:300000,balance:150000,rate:4.61};
const context={window:{MortgageStore:{get:()=>state}},document:{getElementById:()=>null,dispatchEvent(){}},CustomEvent:function(){},Intl,Date,Number};
vm.runInNewContext(declarations,context);
const data=JSON.parse(fs.readFileSync(root.replace(/src$/,'public')+'/market-rates.json','utf8'));
assert.ok(context.validMarketData(data));context.applyMarketRates(data);
assert.equal(context.window.MortgageMarket.twoYear,5.98);assert.equal(context.window.MortgageMarket.fiveYear,6);
assert.equal(context.window.MortgageMarket.sourceLabel,'Moneyfacts');assert.equal(context.window.MortgageMarket.sourceAsOf,'2026-10-05');assert.equal(context.window.MortgageMarket.ltvBand,null);
state={...state,balance:290000};context.applyMarketRates(data);assert.equal(context.window.MortgageMarket.twoYear,5.98);
const historic=structuredClone(data);historic.live={source:'Bank of England Database',sourceAsOf:data.sourceAsOf,twoYear:4.92,fiveYear:4.78};
context.applyMarketRates(historic);assert.equal(context.window.MortgageMarket.twoYear,5.52);assert.equal(context.window.MortgageMarket.ltvBand,95);
for(const patch of [{source:'Unknown'},{sourceUrl:'https://untrusted.example/rates'},{sourceAsOf:''},{twoYear:0}])assert.equal(context.validMarketData({...data,live:{...data.live,...patch}}),false);
console.log('Dated whole-market averages remain separate from historical LTV benchmarks; invalid sources rejected.');
