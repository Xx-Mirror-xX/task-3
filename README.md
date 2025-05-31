# task 3

Este proyecto es una aplicación web que permite:

1- Registro y autenticación de usuarios para mantener la seguridad dentro de la web (y porque confundi formulario de contactos con login y una cosa llevo a la otra) dentro del registro se integro el capchat

2- Formulario de contacto con geolocalización para que el admin (osea yo) pueda tener una mejor organizacion de las personas que mandan sus comentarios para la web por si quieren mejorar la web o solo mensajes de odios, se integro ipapi.co para la geolocalizacion y para el envio de mensajes (para los correos xxsandovalluisxx@gmail.com, programacion2ais@yopmail.com) se integro emailjs.com porque fue la unica que si me funciono 

3- Procedimiento para realizar los pagos, la mayoria de los mensajes de errores y cosas por ese estilo lo hice yo con una ia en la madrugada sin miedo, pero para verificar si la tarjeta funciona o no, se uso el fakepayment.onrender.com 

4- Se agrego un boton de admin dentro del codigo principal (se cambio index.ejs a index.html porque me es mas facil manejar el uso de html y puedo ver mas rapido los errores dentro del codigo { y porque domino un poco mas el html } ) este boton permite ver la tabla de las personas que pusieron su mensajes

5- Se aumento la seguridad para poder acceder a admin, ahora se necesita verificar el gmail y la contrasena, ahora ya no es posible acceder dentro del html de admin si solo colocas el enlace ( para poder a acceder a admin debes colocar: gmail xxsandovaluisxx@gmail.com, contrasena: 12345)

6- Se mejoraron todas las rutas del login y se mejoro el diseno de la pagina principal, para que no sea tan molesto ver como el login y la pagina principal son tan diferentes.

7- Se agrego un archivo .yaml porque ya estaba hasta la madre de colocar todo el rato los datos para abrir la pagina

Cosas Que Faltan:

1- Crear no se que cosas de entorno, ponerlo en un .env y proteger cosas sensibles, llevo dias intentando hacer eso, pero cuando lo hago, deja de funcionar el captcha, o el formulario de contactos, o el login, etc asi que me rendi, tratare de mejorar eso en la siguiente tarea
