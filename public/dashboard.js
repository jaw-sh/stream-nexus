var donation_history = document.querySelector("#donation-history");

var socket = null;
(function () {
    // Create WebSocket connection.
    socket = new WebSocket("ws://127.0.0.2:1350/chat.ws");
    const reconnect = () => {
        // check if socket is connected
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
            return true;
        }
        // attempt to connect
        socket = new WebSocket("ws://127.0.0.2:1350/chat.ws");
    };

    // Connection opened
    socket.addEventListener("open", (event) => {
        console.log("[SNEED] Connection established.");
    });

    // Listen for messages
    socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);

        handle_message(message);
    });

    socket.addEventListener("close", (event) => {
        console.log("[SNEED] Socket has closed. Attempting reconnect.", event.reason);
        setTimeout(function () { reconnect(); }, 3000);
    });

    socket.addEventListener("error", (event) => {
        socket.close();
        setTimeout(function () { reconnect(); }, 3000);
    });
})();

function new_poll_option(count=1) {
    const poll_options = document.querySelector("#poll-options");
    for (var i = 0; i < count; i++) {
        const opt = document.createElement("input");
        opt.setAttribute("type", "text");
        opt.setAttribute("placeholder", `Poll option`);
        opt.setAttribute("class", "poll-option");
        opt.setAttribute("onkeydown", "on_poll_option_type(event)");
        opt.setAttribute("onblur", "on_poll_option_change(event)");
        poll_options.appendChild(opt);
    }
}

function on_poll_option_type(event) {
    // add a new poll option if the last one is filled
    const poll_options = document.querySelectorAll(".poll-option");

    if (poll_options.length >= 15) {
        return; // max 15 options
    }

    const last_option = poll_options[poll_options.length - 1];
    if (last_option.value !== "") {
        new_poll_option();
    }
}

function on_poll_option_change(event) {
    const poll_options = document.querySelectorAll(".poll-option");

    if (poll_options.length <= 2) {
        return; // need at least two options
    }

    if (event.target.value === "") {
        event.target.remove();
    }
}

// Clear poll UI fields.
function clear_poll() {
    pollquestion.value = "";

    // Remove all option boxes with 2 empty ones.
    document.querySelectorAll(".poll-option").forEach((opt) => {
        opt.remove();
    });
    new_poll_option(2);
}

function on_poll_create() {
    const poll_type = multiplechoice.checked ? "multipoll" : "poll";
    const poll_options = document.querySelectorAll(".poll-option");
    const options = [];
    const poll_question = pollquestion.value;

    poll_options.forEach((option) => {
        if (option.value !== "") {
            options.push(option.value);
        }
    });

    if (options.length < 2) {
        alert("You need at least two poll options.");
        return;
    }

    if (poll_question === "") {
        alert("You need a poll question.");
        return;
    }

    const poll_command = `!${poll_type} ${poll_question}; ${options.join("; ")}`;
    send_message(poll_command);

    clear_poll();
}

function on_poll_end() {
    send_message("!endpoll");
}

function send_message(text) {
    function uuidv5() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    const message = {
        "id": uuidv5(),
        "platform": "rumble",
        "username": "mati",
        "message": text,
        "sent_at": Math.round(Date.now() / 1000),
        "received_at": Math.round(Date.now() / 1000),
        "avatar": "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
        "is_premium": false,
        "amount": 0.0,
        "currency": "USD",
        "is_verified": true,
        "is_sub": true,
        "is_mod": true,
        "is_owner": true,
        "is_staff": false,
        "emojis": [],
    }
    const data = { "platform": "rumble", "messages": [message] }
    socket.send(JSON.stringify(data));
}

function handle_message(message) {
    if (message.amount > 0) {
        donation_history.innerHTML = donation_history.innerHTML + message.html;
    }
}
