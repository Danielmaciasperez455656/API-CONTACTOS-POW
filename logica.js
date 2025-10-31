
const express = require("express");
const path = require("path");
const conexion = require("./js/conexionbd.js"); 

const app = express();
const puerto = 3000;


app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// --------------- RUTAS DE LA API ---------------


app.get("/api/contactos", (req, res) => {
    const consulta = `
        SELECT 
            c.id_contacto, c.primer_nombre, c.segundo_nombre, c.primer_apellido, 
            c.segundo_apellido, c.email, c.telefono, c.imagen,
            g.detalle_genero,
            d.detalle_direccion,
            t.detalle_tipo_telefono
        FROM contacto c
        LEFT JOIN genero g ON c.id_genero = g.id_genero
        LEFT JOIN direccion d ON c.id_direccion = d.id_direccion
        LEFT JOIN tipo_telefono t ON c.id_tipo_telefono = t.id_tipo_telefono
        ORDER BY c.primer_nombre;
    `;
    
    conexion.query(consulta, (err, respuesta) => {
        if (err) {
            console.error("Error en la consulta GET:", err);
            res.status(500).json({ error: "Error al obtener contactos" });
        } else {
           
            res.json(respuesta);
        }
    });
});


app.post("/api/contactos", (req, res) => {
    
    const datos = req.body;

    
    const nuevoContacto = {
        primer_nombre: datos.primer_nombre,
        segundo_nombre: datos.segundo_nombre || null,
        primer_apellido: datos.primer_apellido,
        segundo_apellido: datos.segundo_apellido || null,
        id_genero: datos.id_genero || null,
        id_direccion: datos.id_direccion || null,
        id_tipo_telefono: datos.id_tipo_telefono || null,
        email: datos.email || null,
        telefono: datos.telefono || null,
        imagen: datos.imagen || null 
    };

    
    if (!nuevoContacto.primer_nombre || !nuevoContacto.primer_apellido) {
        return res.status(400).json({ error: "El primer nombre y el primer apellido son obligatorios." });
    }

    const consulta = "INSERT INTO contacto SET ?";

    conexion.query(consulta, nuevoContacto, (err, resultado) => {
        if (err) {
            console.error("Error al insertar el contacto:", err);
            res.status(500).json({ error: "Error al crear el contacto. Revisa los datos enviados." });
        } else {
            console.log("Contacto creado con ID:", resultado.insertId);
            
            res.status(201).json({ 
                mensaje: "Contacto creado exitosamente", 
                id: resultado.insertId 
            });
        }
    });
});



app.get("/api/generos", (req, res) => {
    conexion.query("SELECT * FROM genero ORDER BY detalle_genero", (err, data) => {
        if(err) return res.status(500).json({error: "Error al cargar géneros"});
        res.json(data);
    });
});

app.get("/api/direcciones", (req, res) => {
    conexion.query("SELECT * FROM direccion ORDER BY detalle_direccion", (err, data) => {
        if(err) return res.status(500).json({error: "Error al cargar direcciones"});
        res.json(data);
    });
});

app.get("/api/tipos-telefono", (req, res) => {
    conexion.query("SELECT * FROM tipo_telefono ORDER BY detalle_tipo_telefono", (err, data) => {
        if(err) return res.status(500).json({error: "Error al cargar tipos de teléfono"});
        res.json(data);
    });
});


// --------------- INICIAR SERVIDOR ---------------
app.listen(puerto, () => {
    console.log(`Servidor activo en http://localhost:${puerto}`);
    console.log("Sirviendo archivos estáticos desde:", path.join(__dirname, 'public'));
    console.log("Accede a la app en: http://localhost:3000/index.html");
});