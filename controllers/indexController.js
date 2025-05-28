const path = require('path');

const toIndex = (req, res) => {
    if (req.session.userId) {
        res.sendFile(path.join(__dirname, '../vistas', 'indice.html'));
    } else {
        res.sendFile(path.join(__dirname, '../public', 'index.html'));
    }
}

module.exports = toIndex;