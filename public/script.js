(function() {
    const main = document.querySelector("main");

    // Create WebSocket connection.
    const socket = new WebSocket("ws://localhost:1350/chat.ws");
    const reconnect = () => {
        // check if socket is connected
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
            return true;
        }
        // attempt to connect
        const socket = new WebSocket("ws://localhost:1350/chat.ws");
    };

    // Connection opened
    socket.addEventListener("open", (event) => {
        socket.send("Hello Server!");
    });

    // Listen for messages
    socket.addEventListener("message", (event) => {
        const ct = document.createElement("div");
        const el = document.createElement("div");
        main.appendChild(el);
        el.outerHTML = event.data;

        el.scrollIntoView();

        while (main.children.length > 100) {
            main.removeChild(main.firstChild);
        }
    });

    socket.addEventListener("close", (event) => {
        console.log("Socket has closed. Attempting reconnect.", event.reason);
        setTimeout(function() { reconnect(); }, 3000);
    });

    socket.addEventListener("error", (event) => {
        socket.close();
        setTimeout(function() { reconnect(); }, 3000);
    });
})();