const axios = require('axios');

async function fetchStats() {
    try {
        const response = await axios.get('http://eyg2.nl.blare.host:25924/api/2b2tstats');
        const data = response.data;

       console.log(data)
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

fetchStats();
