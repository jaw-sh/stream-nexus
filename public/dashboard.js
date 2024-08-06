const chat_history = document.querySelector("#chat-history");
const donation_history = document.querySelector("#donation-history");

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
        const data = JSON.parse(event.data);
        const message = JSON.parse(data.message);
        switch (data.tag) {
            case "chat_message":
                handle_message(message);
                break;
            case "feature_message":
                handle_feature_message(message);
                break;
            case "viewers":
                handle_viewers(message);
                break;
            default:
                console.log("Unknown tag:", message.tag);
                break;

        }
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

function new_poll_option(count = 1) {
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

function on_click_message(event) {
    console.log(this);
    // if we are sticky, unfeature.
    if (this.classList.contains("msg--sticky")) {
        send_feature_message(null);
    }
    else {
        send_feature_message(this.id);
    }
}

function send_feature_message(id) {
    console.log("Featuring message:", id);
    const message = { "feature_message": id };
    socket.send(JSON.stringify(message));
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

function handle_feature_message(id) {
    // unsticky all existing sticky messages
    const sticky_messages = document.querySelectorAll(".msg--sticky");
    sticky_messages.forEach((msg) => {
        msg.classList.remove("msg--sticky");
    });

    // sticky featured message
    const featured_message = document.getElementById(id);
    if (featured_message !== null) {
        featured_message.classList.add("msg--sticky");
    }
}

function handle_message(message) {
    // check if element already exists
    const existingEl = document.getElementById(message.id);
    if (existingEl !== null) {
        return existingEl;
    }

    // create message el
    let el = document.createElement("div");

    // send to superchat column
    if (message.amount > 0) {
        el = donation_history.appendChild(el);
        el.outerHTML = message.html;
    }
    // send to chat column
    else {
        el = chat_history.appendChild(el);
        el.outerHTML = message.html;

        // prune oldest messages
        while (chat_history.children.length > 1000) {
            for (let i = 0; i < chat_history.children.length; i++) {
                if (!chat_history.childNodes[i].classList.contains("msg--sticky")) {
                    chat_history.childNodes[i].remove();
                    break;
                }
            }
        }
    }

    document.getElementById(message.id).addEventListener("click", on_click_message);
}

function handle_viewers() {
    // Do nothing.
}