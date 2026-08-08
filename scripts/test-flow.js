const axios = require('axios');

async function test() {
    // Admin login
    const loginRes = await axios.post('http://localhost:3000/auth/login', {email: 'admin@kongu.edu', password: 'Admin@123'}, {headers: {'Content-Type': 'application/json'}});
    console.log('Admin login:', loginRes.data.ok ? 'OK' : 'FAILED');
    const token = loginRes.data.data.token;

    // Admin sees all departments
    const deptsRes = await axios.get('http://localhost:3000/api/departments', {headers: {Authorization: 'Bearer ' + token}});
    console.log('\nDepartments:');
    deptsRes.data.data.forEach(d => console.log('  -', d.code, '(' + (d.isActive ? 'active' : 'inactive') + ')', d.assetCount || 0, 'assets'));

    // Admin sees all assets
    const assetsRes = await axios.get('http://localhost:3000/api/assets', {headers: {Authorization: 'Bearer ' + token}});
    console.log('\nAdmin sees', assetsRes.data.data.length, 'assets');
    assetsRes.data.data.forEach(a => console.log('  -', a.assetId, 'dept:', a.department));
}
test().catch(e => console.log('Error:', e.response?.data || e.message));
