const path = require('path');

const toIndex = (req, res) => {
    if (req.isAuthenticated()) {
        res.render('vistas/indice');
    } else {
        res.render('index');
    }
}

module.exports = toIndex;
