(function () {
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
        console.log("[SNEED] Connection established.");
    });

    // Listen for messages
    socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        console.log(message);
        // check if element already exists
        if (document.getElementById(message.id) === null) {
            let el = document.createElement("div");
            main.appendChild(el);
            el.outerHTML = message.html;
            el = document.getElementById(message.id);

            if (message.message.startsWith("!")) {
                handle_command(message);
            }

            if (message.is_premium || message.amount > 0) {
                handle_premium(el, message);
            }

            while (main.children.length > 200) {
                for (let i = 0; i < main.children.length; i++) {
                    if (!main.childNodes[i].classList.contains("msg--sticky")) {
                        main.childNodes[i].remove();
                        break;
                    }
                }
            }
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

var active_poll = null;
const poll_ui = document.getElementById("poll-ui");
const superchat_ui = document.getElementById("superchat-ui");

class poll {
    constructor(question, multi_vote, options) {
        this.question = question;
        this.options = options;
        this.votes = [];
        this.voters = [];
        this.multi_vote = multi_vote;
        this.total_votes = 0;

        for (let i = 0; i < this.options.length; i++) {
            this.votes.push(0);
        }

        this.update();
        poll_ui.style.display = "block";
        poll_ui.classList.remove("fade-out");
        poll_ui.classList.add("fade-in");
        superchat_ui.classList.add("slide-down");

        this.end_timeout = setTimeout(() => {
            this.end_poll();
            active_poll = null;
        }, 1000 * 120); // default poll duration of 2 minutes
    }

    end_poll() {
        poll_ui.classList.remove("fade-in");
        poll_ui.classList.add("fade-out");
        setTimeout(() => { poll_ui.style.display = "none"; }, 500);
        clearTimeout(this.end_timeout);
    }

    update() {
        let participants = this.voters.length;
        let html = `<strong>${this.question}</strong><br><small>${participants} participants</small><ul>`;
        for (let i = 0; i < this.options.length; i++) {
            let percentage = 0;
            if (this.total_votes > 0) {
                percentage = (this.votes[i] / this.total_votes) * 100;
                percentage = percentage.toFixed(2);
            }
            html += `<li>!vote ${i + 1}: ${this.options[i]} - ${this.votes[i]} (${percentage}%)</li>`;
        }

        html += "</ul><small>use !vote [number] to vote</small>";

        poll_ui.innerHTML = html;
    }

    handle_vote_message(data) {
        // check if user has already voted
        if (active_poll.voters.includes(data.username))
            return;

        let args = data.message.replace("!vote", "").trim();
        let result = false;
        if (this.multi_vote) {
            let votes = args.split(" ");
            // remove duplicates
            votes = [...new Set(votes)];

            for (let i = 0; i < votes.length; i++)
                result |= this.handle_vote(votes[i]);
        } else {
            result = this.handle_vote(args);
        }

        if (result) {
            this.voters.push(data.username);
            this.update();
        }
    }

    handle_vote(vote_index) {
        if (isNaN(vote_index))
            return false;

        let i = parseInt(vote_index) - 1;

        if (i < 0 || i > this.options.length)
            return false;

        this.votes[i]++;
        this.total_votes++;
        return true;
    }
}

function handle_command(message) {
    let msg = message.message;
    const is_admin = message.is_owner;

    if (msg.startsWith("!poll") && is_admin) {
        msg = msg.replace("!poll", "").trim();
        let parts = msg.split(";");
        parts = parts.filter(el => el.length != 0);
        if (parts.length < 3)
            return;
        active_poll = new poll(parts[0], false, parts.slice(1));
    }
    else if (msg.startsWith("!multipoll") && is_admin) {
        msg = msg.replace("!multipoll", "").trim();
        let parts = msg.split(";");
        parts = parts.filter(el => el.length != 0);
        if (parts.length < 3)
            return;
        active_poll = new poll(parts[0], true, parts.slice(1));
    }
    else if (msg.startsWith("!endpoll") && is_admin) {
        if (active_poll !== null)
            active_poll.end_poll();
    }

    else if (msg.startsWith("!vote")) {
        if (active_poll === null)
            return;
        active_poll.handle_vote_message(message);
    }
}

function handle_premium(node, message) {
    node.classList.add("msg--sticky");
    recalculate_premium_positions();
}

function recalculate_premium_positions() {
    let premium_messages = document.getElementsByClassName("msg--sticky");
    let top = 5;
    for (let i = 0; i < premium_messages.length; i++) {
        top += premium_messages[i].offsetHeight + 5;
    }

    let space = document.body.scrollHeight / 2;
    if (top > space) {
        console.log(space, top, space - top);
        top = space - top;
    }
    else {
        top = 5;
    }

    for (let i = 0; i < premium_messages.length; i++) {
        premium_messages[i].style.top = `${top}px`;
        top += premium_messages[i].scrollHeight + 5;
    }
}