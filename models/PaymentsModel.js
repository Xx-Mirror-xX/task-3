const sqlite3 = require('sqlite3').verbose();

class PaymentsModel {
    constructor() {
        this.db = new sqlite3.Database('./database.db');
        this.initTable();
    }

    initTable() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT,
                cardName TEXT,
                cardNumber TEXT,
                expiryMonth INTEGER,
                expiryYear INTEGER,
                cvv TEXT,
                amount REAL,
                currency TEXT,
                service TEXT,
                paymentDate DATETIME DEFAULT CURRENT_TIMESTAMP,
                transactionId TEXT,
                status TEXT
            )
        `);
    }

    addPayment(paymentData) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO payments (
                    email, cardName, cardNumber, expiryMonth, 
                    expiryYear, cvv, amount, currency, service
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    paymentData.email,
                    paymentData.cardName,
                    paymentData.cardNumber,
                    paymentData.expiryMonth,
                    paymentData.expiryYear,
                    paymentData.cvv,
                    paymentData.amount,
                    paymentData.currency,
                    paymentData.service
                ],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    updatePayment(id, updateData) {
        return new Promise((resolve, reject) => {
            const setClauses = [];
            const values = [];
            
            for (const [key, value] of Object.entries(updateData)) {
                setClauses.push(`${key} = ?`);
                values.push(value);
            }
            
            values.push(id);
            
            this.db.run(
                `UPDATE payments SET ${setClauses.join(', ')} WHERE id = ?`,
                values,
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    getAllPayments() {
        return new Promise((resolve, reject) => {
            this.db.all(
                "SELECT * FROM payments ORDER BY paymentDate DESC",
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }
}

module.exports = PaymentsModel;
