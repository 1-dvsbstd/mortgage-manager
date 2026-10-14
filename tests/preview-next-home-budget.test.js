const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const modelRoot=process.env.MM_MODEL_ROOT||'src';
const source=fs.readFileSync(`${modelRoot}/next-home-planner.js`,'utf8');
const start=source.indexOf('  function calculateAt(years)'),end=source.indexOf('  function render()',start);
assert.ok(start>=0&&end>start);
const settings={householdIncome:60000,borrowingMultiple:7,savings:20000,cashBuffer:10000,purchaseCosts:10000,saleCosts:5000};
const context={settings,window:{},state:()=>({homeValue:300000,balance:150000,ownership:100,rate:4.5,payment:1100,currentOverpayment:100}),
 currentEstimatedHomeValue:x=>x,trendRate:()=>2.5,projectedHomeValue:(home,rate,years)=>home*(1+rate/100)**years};
vm.runInNewContext(source.slice(start,end),context);
let result=context.calculateAt(0);
assert.equal(result.borrowing,270000,'Legacy custom multiples must not change the fixed 4.5× assumption');
assert.equal(result.budget,415000);
assert.equal(result.availableEquity+result.usableSavings+result.borrowing,result.budget,'Net chart contributions must match net budget');
settings.householdIncome=70000;result=context.calculateAt(0);assert.equal(result.borrowing,315000);assert.equal(result.budget,460000);
settings.cashBuffer=500000;result=context.calculateAt(0);assert.equal(result.availableCash,0);assert.equal(result.availableEquity+result.usableSavings,0);assert.equal(result.budget,result.borrowing);
settings.savings=1000000;result=context.calculateAt(0);assert.equal(result.availableEquity+result.usableSavings+result.borrowing,result.budget);
console.log('Fixed income multiple and net budget reconciliation passed, including excess costs and legacy settings.');
