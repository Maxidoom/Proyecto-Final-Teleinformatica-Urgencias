const http = require("http");

const servidor = http.createServer((solicitud, respuesta) => {

    respuesta.end(
        "Bienvenidos a nuestra tienda"
    );

});

servidor.listen(3000);