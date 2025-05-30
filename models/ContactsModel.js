const sqlite3 = require('sqlite3').verbose();

class ContactsModel {
    constructor() {
        this.db = new sqlite3.Database('./database.db');
        this.initTable();
    }
    
    initTable() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                firstName TEXT NOT NULL,
                lastName TEXT NOT NULL,
                email TEXT NOT NULL,
                message TEXT NOT NULL,
                ipAddress TEXT NOT NULL,
                country TEXT,
                city TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    async addContact(contactData) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO contacts 
                (firstName, lastName, email, message, ipAddress, country, city) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    contactData.firstName,
                    contactData.lastName,
                    contactData.email,
                    contactData.message,
                    contactData.ipAddress,
                    contactData.country || 'Desconocido',
                    contactData.city || 'Desconocido'
                ],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async getAllContacts() {
        return new Promise((resolve, reject) => {
            this.db.all(
                "SELECT * FROM contacts ORDER BY createdAt DESC",
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }
}

module.exports = ContactsModel;
