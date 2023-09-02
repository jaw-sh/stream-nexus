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
            el.scrollIntoView();

            if (message.message.startsWith("!")) {
                handle_command(message);
            }

            if (message.is_premium || message.amount > 0) {
                handle_premium(message);
            }

            while (main.children.length > 100) {
                main.removeChild(main.firstChild);
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
    const is_admin = message.classList.contains("msg--b-owner");

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

function format_donation(message) {
    const currency_symbols = {
        "USD": "$",
        "EUR": "€",
        "GBP": "£",
        "CAD": "C$",
        "AUD": "A$",
        "JPY": "¥"
    };
    let currency = message.currency;
    if (message.currency in currency_symbols)
        currency = currency_symbols[message.currency];

    let amount = message.amount.toFixed(2);

    let message_text = message.message;
    if (message_text.length > 80)
        message_text = message_text.substring(0, 80).trim() + "...";

    return `<div class="superchat"><div class="superchat-message"><strong>${message.username}</strong> (${currency} ${amount}) <p>${message_text}</p></div><div class="superchat-timeout-bar"></div></div>`;
}

function handle_premium(message) {
    if (message.amount <= 0)
        return; // shouldn't happen, but who knows

    let temp = document.createElement("div");
    temp.innerHTML = format_donation(message);
    let el = temp.firstChild;
    superchat_ui.appendChild(el);

    let progress_bars = superchat_ui.getElementsByClassName("superchat-timeout-bar");
    let progress = progress_bars[progress_bars.length - 1]; // last bar is the newest one

    const duration = 1000 * 30;

    // add timeout for message
    setTimeout(() => {
        if (el.parentNode !== null)
            superchat_ui.removeChild(el);
    }, duration);

    // animate width of progress bar
    progress.animate([
        { width: "100%" },
        { width: "0%" }
    ], {
        duration: duration,
        iterations: 1
    }).play();

    while (superchat_ui.children.length > 5) {
        superchat_ui.removeChild(superchat_ui.firstChild);
    }
}