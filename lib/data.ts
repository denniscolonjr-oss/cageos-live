export type LifecycleStatus = "active" | "retired" | "lost" | "in_repair";
export type CheckoutStatus = "in" | "out" | "flagged";

export interface Asset {
  id: string;
  name: string;
  barcode: string;
  category: string;
  make: string;
  model: string;
  location: string;
  kitId: string | null;
  status: CheckoutStatus;
  lifecycle: LifecycleStatus;
  lastUser: string | null;
  lastUpdated: string | null;
  cost: number | null;
  eolDate: string | null;
  serialNumber: string | null;
  serviceFlag: { severity: "critical" | "warning"; reason: string } | null;
}

export interface Kit {
  id: string;
  name: string;
  barcode: string;
  status: "available" | "out" | "partial";
  location: string;
  componentIds: string[];
}

export interface CheckoutRecord {
  id: string;
  user: string;
  initials: string;
  color: string;
  shoot: string;
  kits: string[];
  checkedOutAt: string;
  dueBack: string;
  status: "active" | "overdue" | "returned";
  isGuest?: boolean;
}

export interface Alert {
  id: string;
  type: "critical" | "warning" | "info";
  title: string;
  detail: string;
}

// ── KITS (from Kit Composition sheet) ─────────────────────────
export const KITS: Kit[] = [
  {
    id: "MMG-0000576",
    name: "Venice Cinema Kit",
    barcode: "MMG-0000576",
    status: "out",
    location: "LMG05",
    componentIds: ["MMG-0000001", "MMG-0000002"],
  },
  {
    id: "MMG-0000575",
    name: "Lens Kit",
    barcode: "MMG-0000575",
    status: "out",
    location: "LMG05",
    componentIds: ["MMG-0000003","MMG-0000004","MMG-0000005","MMG-0000006","MMG-0000007","MMG-0000008"],
  },
  {
    id: "MMG-0000577",
    name: "Shure ULXD Wireless Kit",
    barcode: "MMG-0000577",
    status: "available",
    location: "Cellar",
    componentIds: ["MMG-0000023","MMG-0000024","MMG-0000025","MMG-0000026","MMG-0000027","MMG-0000028","MMG-0000029","MMG-0000030"],
  },
  {
    id: "MMG-0000578",
    name: "Sony PXW-450 Kit #1",
    barcode: "MMG-0000578",
    status: "available",
    location: "LMG05",
    componentIds: ["MMG-0000033","MMG-0000034","MMG-0000035","MMG-0000036","MMG-0000037"],
  },
  {
    id: "MMG-0000579",
    name: "Sony PXW-450 Kit #2",
    barcode: "MMG-0000579",
    status: "available",
    location: "LMG05",
    componentIds: ["MMG-0000038","MMG-0000039","MMG-0000040","MMG-0000041","MMG-0000042"],
  },
  {
    id: "MMG-0000580",
    name: "Sony FX6 Kit #1",
    barcode: "MMG-0000580",
    status: "available",
    location: "LMG05",
    componentIds: ["MMG-0000043","MMG-0000044","MMG-0000045"],
  },
  {
    id: "MMG-0000581",
    name: "Sony FX6 Kit #2",
    barcode: "MMG-0000581",
    status: "available",
    location: "LMG05",
    componentIds: ["MMG-0000046","MMG-0000047","MMG-0000048"],
  },
  {
    id: "MMG-0000584",
    name: "Astra 6X Light Kit A",
    barcode: "MMG-0000584",
    status: "available",
    location: "Adams",
    componentIds: ["MMG-0000064","MMG-0000065","MMG-0000066"],
  },
];

// ── ASSETS (representative sample from Master Inventory) ──────
export const ASSETS: Asset[] = [
  { id:"MMG-0000001", name:"Venice MPC-3610", barcode:"MMG-0000001", category:"Video", make:"Sony", model:"MPC-3610", location:"LMG05", kitId:"MMG-0000576", status:"out", lifecycle:"active", lastUser:"Dennis Colon Jr.", lastUpdated:"9:14 AM", cost:40000, eolDate:"2035", serialNumber:"12057", serviceFlag:null },
  { id:"MMG-0000002", name:"SmallHD Monitor", barcode:"MMG-0000002", category:"Video", make:"Small HD", model:"703", location:"LMG05", kitId:"MMG-0000576", status:"out", lifecycle:"active", lastUser:"Dennis Colon Jr.", lastUpdated:"9:14 AM", cost:null, eolDate:null, serialNumber:null, serviceFlag:null },
  { id:"MMG-0000003", name:"Sigma 20MM", barcode:"MMG-0000003", category:"Video", make:"Sigma", model:"20MM", location:"LMG05", kitId:"MMG-0000575", status:"out", lifecycle:"active", lastUser:"Dennis Colon Jr.", lastUpdated:"9:14 AM", cost:null, eolDate:null, serialNumber:null, serviceFlag:null },
  { id:"MMG-0000004", name:"Sigma 50MM", barcode:"MMG-0000004", category:"Video", make:"Sigma", model:"50MM", location:"LMG05", kitId:"MMG-0000575", status:"out", lifecycle:"active", lastUser:"Dennis Colon Jr.", lastUpdated:"9:14 AM", cost:null, eolDate:null, serialNumber:null, serviceFlag:null },
  { id:"MMG-0000005", name:"Sigma 85MM", barcode:"MMG-0000005", category:"Video", make:"Sigma", model:"85MM", location:"LMG05", kitId:"MMG-0000575", status:"flagged", lifecycle:"in_repair", lastUser:"A. Fuentes", lastUpdated:"Yesterday", cost:null, eolDate:null, serialNumber:null, serviceFlag:{ severity:"critical", reason:"Returned damaged — front element scratched" } },
  { id:"MMG-0000006", name:"Fujinon 35-150", barcode:"MMG-0000006", category:"Video", make:"Fujinon", model:"35-150", location:"LMG05", kitId:"MMG-0000575", status:"out", lifecycle:"active", lastUser:"Dennis Colon Jr.", lastUpdated:"9:14 AM", cost:null, eolDate:null, serialNumber:null, serviceFlag:null },
  { id:"MMG-0000007", name:"Fujinon 18-55", barcode:"MMG-0000007", category:"Video", make:"Fujinon", model:"18-55", location:"LMG05", kitId:"MMG-0000575", status:"out", lifecycle:"active", lastUser:"Dennis Colon Jr.", lastUpdated:"9:14 AM", cost:null, eolDate:null, serialNumber:null, serviceFlag:null },
  { id:"MMG-0000008", name:"Kenko Color Meter", barcode:"MMG-0000008", category:"Video", make:"Kenko", model:"Color Meter", location:"LMG05", kitId:"MMG-0000575", status:"out", lifecycle:"active", lastUser:"Dennis Colon Jr.", lastUpdated:"9:14 AM", cost:null, eolDate:null, serialNumber:null, serviceFlag:null },
  { id:"MMG-0000009", name:"DJI Wireless Lavs", barcode:"MMG-0000009", category:"Audio", make:"DJI", model:"Mic 2", location:"LMG05", kitId:null, status:"in", lifecycle:"active", lastUser:"T. Okafor", lastUpdated:"7:58 AM", cost:null, eolDate:null, serialNumber:null, serviceFlag:null },
  { id:"MMG-0000023", name:"ULXD2 Handheld #1", barcode:"MMG-0000023", category:"Audio", make:"Shure", model:"ULXD2", location:"Cellar", kitId:"MMG-0000577", status:"in", lifecycle:"active", lastUser:null, lastUpdated:null, cost:null, eolDate:null, serialNumber:null, serviceFlag:null },
  { id:"MMG-0000024", name:"ULXD2 Handheld #2", barcode:"MMG-0000024", category:"Audio", make:"Shure", model:"ULXD2", location:"Cellar", kitId:"MMG-0000577", status:"in", lifecycle:"active", lastUser:null, lastUpdated:null, cost:null, eolDate:null, serialNumber:null, serviceFlag:null },
  { id:"MMG-0000026", name:"Shure Lav Belt Pack", barcode:"MMG-0000026", category:"Audio", make:"Shure", model:"ULXD1", location:"Cellar", kitId:"MMG-0000577", status:"in", lifecycle:"active", lastUser:"T. Okafor", lastUpdated:"7:58 AM", cost:null, eolDate:null, serialNumber:null, serviceFlag:null },
  { id:"MMG-0000033", name:"Sony PXW-450 #1", barcode:"MMG-0000033", category:"Video", make:"Sony", model:"PXW-Z450", location:"LMG05", kitId:"MMG-0000578", status:"in", lifecycle:"active", lastUser:null, lastUpdated:null, cost:null, eolDate:null, serialNumber:null, serviceFlag:null },
  { id:"MMG-0000043", name:"Sony FX6 #1", barcode:"MMG-0000043", category:"Video", make:"Sony", model:"FX6", location:"LMG05", kitId:"MMG-0000580", status:"in", lifecycle:"active", lastUser:null, lastUpdated:null, cost:null, eolDate:null, serialNumber:null, serviceFlag:null },
  { id:"MMG-0000064", name:"Astra 6X Panel #1", barcode:"MMG-0000064", category:"Lighting", make:"Litepanels", model:"Astra 6X", location:"Adams", kitId:"MMG-0000584", status:"in", lifecycle:"active", lastUser:null, lastUpdated:null, cost:null, eolDate:null, serialNumber:null, serviceFlag:null },
  { id:"MMG-0000202", name:"Middle Atlantic UPS", barcode:"MMG-0000202", category:"Misc Prod", make:"Middle Atlantic", model:"UPS", location:"LMG05", kitId:null, status:"in", lifecycle:"active", lastUser:null, lastUpdated:null, cost:null, eolDate:null, serialNumber:null, serviceFlag:null },
  { id:"MMG-0000224", name:"4Ch XLR Network Extender #1", barcode:"MMG-0000224", category:"Audio", make:"", model:"", location:"Adams", kitId:null, status:"out", lifecycle:"active", lastUser:"Jamie Lee (Guest)", lastUpdated:"8:31 AM", cost:null, eolDate:null, serialNumber:null, serviceFlag:null },
  { id:"MMG-0000225", name:"4Ch XLR Network Extender #2", barcode:"MMG-0000225", category:"Audio", make:"", model:"", location:"Adams", kitId:null, status:"out", lifecycle:"active", lastUser:"Jamie Lee (Guest)", lastUpdated:"8:31 AM", cost:null, eolDate:null, serialNumber:null, serviceFlag:null },
  { id:"MMG-0000226", name:"iPad Pro (case)", barcode:"MMG-0000226", category:"Misc Prod", make:"Apple", model:"iPad Pro", location:"Adams", kitId:null, status:"out", lifecycle:"active", lastUser:"Jamie Lee (Guest)", lastUpdated:"8:31 AM", cost:null, eolDate:null, serialNumber:null, serviceFlag:null },
  { id:"MMG-0000227", name:"ECLProfile CT+ #1", barcode:"MMG-0000227", category:"Lighting", make:"ETC", model:"ECLProfile CT+", location:"Adams", kitId:null, status:"out", lifecycle:"active", lastUser:"Marcus Reynolds", lastUpdated:"8:52 AM", cost:null, eolDate:null, serialNumber:null, serviceFlag:null },
  { id:"MMG-0000228", name:"ECLProfile CT+ #2", barcode:"MMG-0000228", category:"Lighting", make:"ETC", model:"ECLProfile CT+", location:"Adams", kitId:null, status:"out", lifecycle:"active", lastUser:"Marcus Reynolds", lastUpdated:"8:52 AM", cost:null, eolDate:null, serialNumber:null, serviceFlag:null },
  { id:"MMG-0000229", name:"Lilliput 8K Monitor #1", barcode:"MMG-0000229", category:"Video", make:"Lilliput", model:"8K", location:"LMG05", kitId:null, status:"out", lifecycle:"active", lastUser:"Marcus Reynolds", lastUpdated:"8:52 AM", cost:null, eolDate:null, serialNumber:null, serviceFlag:null },
  { id:"MMG-0000230", name:"Lilliput 8K Monitor #2", barcode:"MMG-0000230", category:"Video", make:"Lilliput", model:"8K", location:"LMG05", kitId:null, status:"out", lifecycle:"active", lastUser:"Marcus Reynolds", lastUpdated:"8:52 AM", cost:null, eolDate:null, serialNumber:null, serviceFlag:null },
];

// ── LIVE CHECKOUTS ────────────────────────────────────────────
export const CHECKOUTS: CheckoutRecord[] = [
  { id:"co-001", user:"Dennis Colon Jr.", initials:"DC", color:"#60a5fa", shoot:"DOI Interview B-Roll", kits:["Venice Cinema Kit","Lens Kit (5 items)"], checkedOutAt:"9:14 AM", dueBack:"6:00 PM", status:"active" },
  { id:"co-002", user:"Marcus Reynolds", initials:"MR", color:"#f59e0b", shoot:"Capitol Event Coverage", kits:["ECLProfile CT+ ×2","Lilliput 8K Monitor ×2"], checkedOutAt:"8:52 AM", dueBack:"8:00 PM", status:"active" },
  { id:"co-003", user:"Jamie Lee (Guest)", initials:"JL", color:"#a78bfa", shoot:"Adams Portrait Session", kits:["4Ch XLR Extender ×2","iPad Pro"], checkedOutAt:"8:31 AM", dueBack:"8:00 AM", status:"overdue", isGuest:true },
];

// ── ALERTS ────────────────────────────────────────────────────
export const ALERTS: Alert[] = [
  { id:"al-001", type:"critical", title:"Sigma 85MM — critical flag", detail:"Returned damaged · A. Fuentes · Yesterday" },
  { id:"al-002", type:"critical", title:"4Ch XLR Extender — overdue", detail:"J. Lee guest token · Due 8:00 AM today" },
  { id:"al-003", type:"warning", title:"Kit drift — Venice kit MMG-0000576", detail:"SmallHD monitor missing on return · 2 days ago" },
  { id:"al-004", type:"warning", title:"Kit drift — Shure ULXD kit", detail:"ULXD1 beltpack not returned · Today" },
  { id:"al-005", type:"info", title:"220 assets past estimated EOL", detail:"Review replacement schedule in admin" },
];

// ── STATS ─────────────────────────────────────────────────────
export const STATS = {
  totalAssets: 600,
  checkedIn: 593,
  checkedOut: 7,
  serviceFlags: 3,
  criticalFlags: 1,
  kitDriftEvents: 2,
  knownInventoryValue: 53824,
};

// ── SHOOTS (for kiosk selection) ─────────────────────────────
export const SHOOTS = [
  { id:"sh-001", title:"DOI Interview B-Roll", client:"Dept of Interior", when:"Today 10AM – 4PM" },
  { id:"sh-002", title:"Capitol Event Coverage", client:"Capitol Hill", when:"Today 2PM – 7PM" },
  { id:"sh-003", title:"Library Portrait Series", client:"Library of Congress", when:"Tomorrow 9AM – 1PM" },
  { id:"sh-004", title:"General use / no shoot", client:"Ad hoc", when:"" },
];

// ── DEMO USERS (for kiosk) ────────────────────────────────────
export const DEMO_USERS = [
  { name:"Dennis Colon Jr.", role:"Broadcast Engineer", initials:"DC", color:"#60a5fa" },
  { name:"Marcus Reynolds", role:"Camera Operator", initials:"MR", color:"#f59e0b" },
  { name:"Tanya Okafor", role:"Audio Technician", initials:"TO", color:"#4ade80" },
  { name:"Jamie Lee", role:"Freelance DP · Guest token", initials:"JL", color:"#a78bfa", isGuest:true },
];
