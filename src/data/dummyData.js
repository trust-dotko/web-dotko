// Kept as local fallback / dev reference only.
// In production all data comes from Firestore.

export const businesses = {
  '27AADCB2230M1ZP': {
    name: 'Bharat Exports Pvt Ltd',
    gst:  '27AADCB2230M1ZP',
    pan:  'AADCB2230M',
    state: 'Maharashtra',
    city:  'Mumbai',
    type:  'Private Limited',
    incorporated: '2015-03-12',
    industry: 'Export & Import',
    registeredAddress: '402, Trade Tower, BKC, Mumbai – 400051',
  },
  '29ABCFM9634R1ZF': {
    name: 'Meridian Tech Solutions',
    gst:  '29ABCFM9634R1ZF',
    pan:  'ABCFM9634R',
    state: 'Karnataka',
    city:  'Bengaluru',
    type:  'Private Limited',
    incorporated: '2018-07-22',
    industry: 'IT Services',
    registeredAddress: '12, Koramangala Industrial Layout, Bengaluru – 560034',
  },
  '07AAHCS1429D1ZX': {
    name: 'SwiftLogix India Ltd',
    gst:  '07AAHCS1429D1ZX',
    pan:  'AAHCS1429D',
    state: 'Delhi',
    city:  'New Delhi',
    type:  'Public Limited',
    incorporated: '2010-11-05',
    industry: 'Logistics & Supply Chain',
    registeredAddress: 'Plot 7, Sector 62, Noida – 201301',
  },
  '33AABCT3518Q1ZV': {
    name: 'Coastal Agro Traders',
    gst:  '33AABCT3518Q1ZV',
    pan:  'AABCT3518Q',
    state: 'Tamil Nadu',
    city:  'Chennai',
    type:  'Partnership',
    incorporated: '2012-04-18',
    industry: 'Agriculture & Commodities',
    registeredAddress: '88, Anna Salai, Chennai – 600002',
  },
};

export const trades = {
  '27AADCB2230M1ZP': [
    { id: 't1', buyer: 'Reliance Industries', amount: 450000, creditDays: 30, actualDays: 28, status: 'Paid' },
    { id: 't2', buyer: 'Tata Steel',          amount: 280000, creditDays: 45, actualDays: 52, status: 'Delayed' },
    { id: 't3', buyer: 'HDFC Bank',           amount: 175000, creditDays: 30, actualDays: 30, status: 'Paid' },
    { id: 't4', buyer: 'Infosys Ltd',         amount: 320000, creditDays: 60, actualDays: 90, status: 'Unpaid' },
    { id: 't5', buyer: 'Wipro Ltd',           amount: 95000,  creditDays: 30, actualDays: 33, status: 'Delayed' },
  ],
  '29ABCFM9634R1ZF': [
    { id: 't6', buyer: 'Flipkart Pvt Ltd',   amount: 560000, creditDays: 30, actualDays: 29, status: 'Paid' },
    { id: 't7', buyer: 'Amazon India',        amount: 410000, creditDays: 45, actualDays: 45, status: 'Paid' },
    { id: 't8', buyer: 'Swiggy',             amount: 230000, creditDays: 30, actualDays: 30, status: 'Paid' },
  ],
  '07AAHCS1429D1ZX': [
    { id: 't9',  buyer: 'Mahindra & Mahindra', amount: 780000, creditDays: 60, actualDays: 90, status: 'Unpaid' },
    { id: 't10', buyer: 'Bajaj Auto',          amount: 340000, creditDays: 30, actualDays: 48, status: 'Delayed' },
    { id: 't11', buyer: 'Hero MotoCorp',       amount: 220000, creditDays: 45, actualDays: 80, status: 'Unpaid' },
    { id: 't12', buyer: 'TVS Motors',          amount: 190000, creditDays: 30, actualDays: 35, status: 'Delayed' },
  ],
  '33AABCT3518Q1ZV': [],
};

export const recentSearches = [
  { gst: '27AADCB2230M1ZP', name: 'Bharat Exports Pvt Ltd',  searchedAt: '2024-03-10T09:14:00Z' },
  { gst: '29ABCFM9634R1ZF', name: 'Meridian Tech Solutions', searchedAt: '2024-03-09T15:30:00Z' },
  { gst: '07AAHCS1429D1ZX', name: 'SwiftLogix India Ltd',    searchedAt: '2024-03-09T11:05:00Z' },
  { gst: '33AABCT3518Q1ZV', name: 'Coastal Agro Traders',    searchedAt: '2024-03-08T14:22:00Z' },
];
