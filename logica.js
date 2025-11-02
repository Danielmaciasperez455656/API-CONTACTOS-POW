const express = require("express");
const path = require("path");
const conexion = require("./js/conexionbd.js");
const util = require("util");

const app = express();
const puerto = 3000;

// --- Configuración EJS y rutas estáticas ---
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Promisificar query para usar async/await ---
const query = util.promisify(conexion.query).bind(conexion);

// --------------- RUTA PRINCIPAL ---------------
app.get("/", async (req, res) => {
    try {
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

        const contactos = await query(consultaContactos);

        const consultaEstadisticas = `
            SELECT 
                d.detalle_direccion AS barrio, 
                COUNT(*) AS total
            FROM contacto c
            LEFT JOIN direccion d ON c.id_direccion = d.id_direccion
            GROUP BY d.detalle_direccion
            ORDER BY total DESC;
        `;
        const estadisticasRaw = await query(consultaEstadisticas);

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

    } catch (err) {
        console.error("Error al cargar la página principal:", err);
        res.render("index", {
            titulo: "Error de Conexión",
            contactos: [],
            estadisticas: []
        });
    }
});

// --------------- FORMULARIO CREAR CONTACTO ---------------
app.get("/crear", async (req, res) => {
    try {
        const generos = await query("SELECT id_genero, detalle_genero FROM genero ORDER BY detalle_genero");
        const direcciones = await query("SELECT id_direccion, detalle_direccion FROM direccion ORDER BY detalle_direccion");
        const tiposTelefono = await query("SELECT id_tipo_telefono, detalle_tipo_telefono FROM tipo_telefono ORDER BY detalle_tipo_telefono");

        res.render("crearcontacto", {
            titulo: "Crear Nuevo Contacto",
            generos,
            direcciones,
            tiposTelefono
        });
    } catch (err) {
        console.error("Error al obtener datos para el formulario de creación:", err);
        res.render("crearcontacto", {
            titulo: "Crear Contacto - Error",
            generos: [],
            direcciones: [],
            tiposTelefono: []
        });
    }
});

// --------------- CREAR CONTACTO ---------------
app.post("/api/contactos", async (req, res) => {
    try {
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

        const resultado = await query("INSERT INTO contacto SET ?", nuevoContacto);
        console.log("Contacto creado con ID:", resultado.insertId);

        res.status(201).json({
            mensaje: "Contacto creado exitosamente",
            id: resultado.insertId
        });
    } catch (err) {
        console.error("Error al insertar el contacto:", err);
        res.status(500).json({ error: "Error al crear el contacto. Revisa los datos enviados." });
    }
});

// --------------- API AUXILIARES ---------------
app.get("/api/generos", async (req, res) => {
    try {
        const data = await query("SELECT * FROM genero ORDER BY detalle_genero");
        res.json(data);
    } catch {
        res.status(500).json({ error: "Error al cargar géneros" });
    }
});

app.get("/api/direcciones", async (req, res) => {
    try {
        const data = await query("SELECT * FROM direccion ORDER BY detalle_direccion");
        res.json(data);
    } catch {
        res.status(500).json({ error: "Error al cargar direcciones" });
    }
});

app.get("/api/tipos-telefono", async (req, res) => {
    try {
        const data = await query("SELECT * FROM tipo_telefono ORDER BY detalle_tipo_telefono");
        res.json(data);
    } catch {
        res.status(500).json({ error: "Error al cargar tipos de teléfono" });
    }
});

// --------------- EDITAR CONTACTO ---------------
app.get("/editar/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const [contacto] = await query("SELECT * FROM contacto WHERE id_contacto = ?", [id]);

        if (!contacto) return res.status(404).send("Contacto no encontrado.");

        const generos = await query("SELECT id_genero, detalle_genero FROM genero ORDER BY detalle_genero");
        const direcciones = await query("SELECT id_direccion, detalle_direccion FROM direccion ORDER BY detalle_direccion");
        const tiposTelefono = await query("SELECT id_tipo_telefono, detalle_tipo_telefono FROM tipo_telefono ORDER BY detalle_tipo_telefono");

        res.render("editarcontacto", {
            titulo: "Editar Contacto",
            contacto,
            generos,
            direcciones,
            tiposTelefono
        });

    } catch (err) {
        console.error("Error al cargar el formulario de edición:", err);
        res.status(500).send("Error al cargar el formulario de edición.");
    }
});

// --------------- GUARDAR CAMBIOS CONTACTO ---------------
app.post("/api/contactos/editar/:id", async (req, res) => {
    const id = req.params.id;
    const datos = req.body;

    try {
        const [resultadoSelect] = await query("SELECT imagen FROM contacto WHERE id_contacto = ?", [id]);
        const imagenActual = resultadoSelect?.imagen || null;

        const imagenFinal =
            datos.imagen && datos.imagen.trim() !== "" ? datos.imagen : imagenActual;

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

        await query(
            `UPDATE contacto 
             SET primer_nombre = ?, segundo_nombre = ?, primer_apellido = ?, segundo_apellido = ?,
                 id_genero = ?, id_direccion = ?, id_tipo_telefono = ?, email = ?, telefono = ?, imagen = ?
             WHERE id_contacto = ?`,
            valores
        );

        console.log("✅ Contacto actualizado correctamente:", id);
        res.redirect("/");

    } catch (err) {
        console.error("Error al actualizar contacto:", err);
        res.status(500).send("Error al actualizar el contacto.");
    }
});

// --------------- ELIMINAR CONTACTO ---------------
app.get("/api/contactos/eliminar/:id", async (req, res) => {
    const id = req.params.id;

    try {
        await query("DELETE FROM contacto WHERE id_contacto = ?", [id]);
        console.log("Contacto eliminado con ID:", id);
        res.redirect("/");
    } catch (err) {
        console.error("Error al eliminar contacto:", err);
        res.status(500).send("Error al eliminar el contacto.");
    }
});

// --------------- INICIAR SERVIDOR ---------------
app.listen(puerto, () => {
    console.log(`Servidor activo en http://localhost:${puerto}`);
    console.log("Sirviendo archivos estáticos desde:", path.join(__dirname, "public"));
});
