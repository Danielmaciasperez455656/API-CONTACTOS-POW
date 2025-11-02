// js/conexionbd.js
const mysql = require("mysql2");

// 1. Configura la conexión
let conexion = mysql.createConnection({
    host: "localhost",
    database: "api_pow",
    user: "root",
    password: "Leo@2110", // Asegúrate de que esta sea tu contraseña
});

// 2. Conecta a la base de datos
conexion.connect(function(err) {
    if (err) {
        console.error("Error al conectar a la base de datos:", err);
        throw err;
    } else {
        console.log("Conexión a la BD 'contactos' exitosa.");
    }
});

// 3. Exporta la conexión para que otros archivos la usen
module.exports = conexion;
