const express = require("express");
const path = require("path");
const conexion = require("./js/conexionbd.js");

const app = express();
const puerto = 3000;

// --- CONFIGURACIÓN EJS Y RUTAS ESTÁTICAS ---
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------- RUTA PRINCIPAL (INTERFAZ) ---------------
app.get("/", (req, res) => {
    const consultaContactos = `
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

    const consultaEstadisticas = `
        SELECT 
            d.detalle_direccion AS barrio, 
            COUNT(*) AS total
        FROM contacto c
        LEFT JOIN direccion d ON c.id_direccion = d.id_direccion
        GROUP BY d.detalle_direccion
        ORDER BY total DESC;
    `;

    conexion.query(consultaContactos, (errContactos, contactos) => {
        if (errContactos) {
            console.error("Error al obtener contactos:", errContactos);
            return res.render("index", {
                titulo: "Error de Conexión",
                contactos: [],
                estadisticas: []
            });
        }

        conexion.query(consultaEstadisticas, (errEstadisticas, estadisticasRaw) => {
            if (errEstadisticas) {
                console.error("Error al obtener estadísticas:", errEstadisticas);
                return res.render("index", {
                    titulo: "Directorio de Contactos",
                    contactos,
                    estadisticas: []
                });
            }

            const totalContactos = estadisticasRaw.reduce((sum, e) => sum + e.total, 0);
            const estadisticas = estadisticasRaw.map(e => ({
                barrio: e.barrio || "Sin barrio",
                total: e.total,
                porcentaje: totalContactos > 0 ? (e.total / totalContactos) * 100 : 0
            }));

            res.render("index", {
                titulo: "Directorio de Contactos",
                contactos,
                estadisticas
            });
        });
    });
});

// 2. Ruta para el formulario de creación de contacto
app.get("/crear", (req, res) => {
    const consultas = [
        "SELECT id_genero, detalle_genero FROM genero ORDER BY detalle_genero",
        "SELECT id_direccion, detalle_direccion FROM direccion ORDER BY detalle_direccion",
        "SELECT id_tipo_telefono, detalle_tipo_telefono FROM tipo_telefono ORDER BY detalle_tipo_telefono"
    ];

    conexion.query(consultas.join(";"), (err, resultados) => {
        if (err) {
            console.error("Error al obtener datos para el formulario de creación:", err);
            res.render("crearcontacto", {
                titulo: "Crear Contacto - Error",
                generos: [],
                direcciones: [],
                tiposTelefono: []
            });
        } else {
            res.render("crearcontacto", {
                titulo: "Crear Nuevo Contacto",
                generos: resultados[0],
                direcciones: resultados[1],
                tiposTelefono: resultados[2]
            });
        }
    });
});

// --------------- RUTAS DE LA API ---------------
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
        if (err) return res.status(500).json({ error: "Error al cargar géneros" });
        res.json(data);
    });
});

app.get("/api/direcciones", (req, res) => {
    conexion.query("SELECT * FROM direccion ORDER BY detalle_direccion", (err, data) => {
        if (err) return res.status(500).json({ error: "Error al cargar direcciones" });
        res.json(data);
    });
});

app.get("/api/tipos-telefono", (req, res) => {
    conexion.query("SELECT * FROM tipo_telefono ORDER BY detalle_tipo_telefono", (err, data) => {
        if (err) return res.status(500).json({ error: "Error al cargar tipos de teléfono" });
        res.json(data);
    });
});

// --------------- EDITAR CONTACTO ---------------
app.get("/editar/:id", (req, res) => {
    const id = req.params.id;

    const consultaContacto = "SELECT * FROM contacto WHERE id_contacto = ?";
    const consultaGeneros = "SELECT id_genero, detalle_genero FROM genero ORDER BY detalle_genero";
    const consultaDirecciones = "SELECT id_direccion, detalle_direccion FROM direccion ORDER BY detalle_direccion";
    const consultaTipos = "SELECT id_tipo_telefono, detalle_tipo_telefono FROM tipo_telefono ORDER BY detalle_tipo_telefono";

    conexion.query(consultaContacto, [id], (err, resultado) => {
        if (err) {
            console.error("Error al obtener contacto:", err);
            return res.status(500).send("Error al cargar el contacto.");
        }
        if (resultado.length === 0) {
            return res.status(404).send("Contacto no encontrado.");
        }

        const contacto = resultado[0];

        // Ejecutamos las otras consultas en paralelo
        conexion.query(consultaGeneros, (errG, generos) => {
            if (errG) generos = [];
            conexion.query(consultaDirecciones, (errD, direcciones) => {
                if (errD) direcciones = [];
                conexion.query(consultaTipos, (errT, tiposTelefono) => {
                    if (errT) tiposTelefono = [];

                    res.render("editarcontacto", {
                        titulo: "Editar Contacto",
                        contacto,
                        generos,
                        direcciones,
                        tiposTelefono
                    });
                });
            });
        });
    });
});

// ✅ CORREGIDO: Guardar cambios del contacto
app.post("/api/contactos/editar/:id", (req, res) => {
    const id = req.params.id;
    const datos = req.body;

    const consultaSelect = "SELECT imagen FROM contacto WHERE id_contacto = ?";
    conexion.query(consultaSelect, [id], (errSelect, resultado) => {
        if (errSelect) {
            console.error("Error al obtener imagen actual:", errSelect);
            return res.status(500).send("Error al obtener imagen actual.");
        }

        const imagenActual = resultado[0]?.imagen || null;

        // 🧩 validación corregida — evita error si 'datos.imagen' no existe
        const imagenFinal =
            datos.imagen && typeof datos.imagen === "string" && datos.imagen.trim() !== ""
                ? datos.imagen
                : imagenActual;

        const consultaUpdate = `
            UPDATE contacto 
            SET primer_nombre = ?, segundo_nombre = ?, primer_apellido = ?, segundo_apellido = ?,
                id_genero = ?, id_direccion = ?, id_tipo_telefono = ?, email = ?, telefono = ?, imagen = ?
            WHERE id_contacto = ?;
        `;

        const valores = [
            datos.primer_nombre,
            datos.segundo_nombre || null,
            datos.primer_apellido,
            datos.segundo_apellido || null,
            datos.id_genero || null,
            datos.id_direccion || null,
            datos.id_tipo_telefono || null,
            datos.email || null,
            datos.telefono || null,
            imagenFinal,
            id
        ];

        conexion.query(consultaUpdate, valores, (errUpdate) => {
            if (errUpdate) {
                console.error("Error al actualizar contacto:", errUpdate);
                res.status(500).send("Error al actualizar el contacto.");
            } else {
                console.log("✅ Contacto actualizado correctamente:", id);
                res.redirect("/");
            }
        });
    });
});

// --------------- ELIMINAR CONTACTO ---------------
app.get("/api/contactos/eliminar/:id", (req, res) => {
    const id = req.params.id;
    const consulta = "DELETE FROM contacto WHERE id_contacto = ?";

    conexion.query(consulta, [id], (err) => {
        if (err) {
            console.error("Error al eliminar contacto:", err);
            res.status(500).send("Error al eliminar el contacto.");
        } else {
            console.log("Contacto eliminado con ID:", id);
            res.redirect("/");
        }
    });
});

// --------------- INICIAR SERVIDOR ---------------
app.listen(puerto, () => {
    console.log(`Servidor activo en http://localhost:${puerto}`);
    console.log("Sirviendo archivos estáticos desde:", path.join(__dirname, "public"));
    console.log("Accede a la app en: http://localhost:3000/");
});
