const mysql = require("mysql2");

const conexion = mysql.createConnection({
    host: "localhost",
    user: "root",

    database: "urgencias" //nombre de la base de datos
});

conexion.connect(error => {
    if (error) {
        console.log("Error de conexión");
        return;
    }

    console.log("Conectado a MySQL");
});

module.exports = conexion;