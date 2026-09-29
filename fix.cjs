const fs = require('fs');
let code = fs.readFileSync('src/components/hospital/hospital-detail.tsx', 'utf8');
const badStr = "const canApprove = ['Admin', 'Estoque', 'Conferente'].includes(role || '');";
code = code.split(badStr).join('');

// Re-add the missing `const canApprove = ...` where it belongs.
// It was inside StockSection:
// function StockSection({ hospitalId, hospitalName, section, stockType, materials, allHospitals, userRole, ...
// Let's insert it back. We will just look at the component StockSection later.

fs.writeFileSync('src/components/hospital/hospital-detail.tsx', code);
