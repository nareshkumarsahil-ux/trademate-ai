export type DataStatus='LIVE'|'DELAYED'|'STALE'|'UNAVAILABLE'|'DEMO';
export interface MarketObject{timestamp:string;source:string;dataStatus:DataStatus}
export interface Quote extends MarketObject{symbol:string;price:number;previousClose:number;change:number;changePercent:number;open:number;high:number;low:number;volume:number;averageVolume?:number}
export interface MarketDataProvider{getQuotes(symbols?:string[]):Promise<Quote[]>;getQuote(symbol:string):Promise<Quote|null>;getHistoricalData(symbol:string,range:string):Promise<unknown[]>;getMarketStatus():Promise<MarketObject&{status:'OPEN'|'CLOSED'|'PRE_OPEN'}>;getIndexData():Promise<unknown[]>;subscribeMarketFeed(symbols:string[],onQuote:(q:Quote)=>void):()=>void}
/** Safe default: returns unavailable, never fabricated prices. */
export class UnavailableProvider implements MarketDataProvider{
 private meta(){return{timestamp:new Date().toISOString(),source:'none',dataStatus:'UNAVAILABLE' as const}}
 async getQuotes(_symbols?:string[]){return[]} async getQuote(_symbol:string){return null} async getHistoricalData(_symbol:string,_range:string){return[]} async getIndexData(){return[]}
 async getMarketStatus(){return{...this.meta(),status:'CLOSED' as const}} subscribeMarketFeed(_symbols:string[],_onQuote:(q:Quote)=>void){return()=>{}}
}
