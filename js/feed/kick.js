// ==UserScript==
// @name S.N.E.E.D. (Kick)
// @version 1.0.0
// @description Stream Nexus userscript for Kick chat.
// @license BSD-3-Clause
// @author Joshua Moon <josh@josh.rs>
// @homepageURL https://github.com/jaw-sh/stream-nexus
// @supportURL https://github.com/jaw-sh/stream-nexus/issues
// @include https://kick.com/*
// @include https://kick.com/*/chatroom
// @connect *
// @grant GM_getValue
// @grant GM_setValue
// @grant GM_deleteValue
// @grant GM_listValues
// @grant GM_addValueChangeListener
// @grant GM_openInTab
// @grant GM_xmlhttpRequest
// @grant GM.getValue
// @grant GM.setValue
// @grant GM.deleteValue
// @grant GM.listValues
// @grant GM.openInTab
// @grant GM.xmlHttpRequest
// @run-at document-start
// ==/UserScript==

(function () {
    'use strict';

    //
    // Socket Logic
    //
    let CHAT_SOCKET = new WebSocket("ws://localhost:1350/chat.ws");
    const reconnect = () => {
        // check if socket is connected
        if (CHAT_SOCKET.readyState === WebSocket.OPEN || CHAT_SOCKET.readyState === WebSocket.CONNECTING) {
            return true;
        }
        else {
            // attempt to connect if disconnected
            CHAT_SOCKET = new WebSocket("ws://localhost:1350/chat.ws");
        }
    };

    // Connection opened
    CHAT_SOCKET.addEventListener("open", (event) => {
        console.log("[SNEED] Socket connection established.");
        SEND_MESSAGES(MESSAGE_QUEUE);
        MESSAGE_QUEUE = [];
    });

    CHAT_SOCKET.addEventListener("close", (event) => {
        console.log("[SNEED] Socket has closed. Attempting reconnect.", event.reason);
        setTimeout(function () { reconnect(); }, 3000);
    });

    CHAT_SOCKET.addEventListener("error", (event) => {
        console.log("[SNEED] Socket has errored. Closing.", event.reason);
        alert("The SNEED chat socket could not connect. Ensure the web server is running and that Brave shields are off.");
        socket.close();
    });

    //
    // Chat Messages
    //
    let MESSAGE_QUEUE = [];

    const CREATE_MESSAGE = () => {
        return {
            id: crypto.randomUUID(),
            platform: "IDK",
            username: "DUMMY_USER",
            message: "",
            sent_at: Date.now(), // System timestamp for display ordering.
            received_at: Date.now(), // Local timestamp for management.
            avatar: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
            is_premium: false,
            amount: 0,
            currency: "ZWL",
            is_verified: false,
            is_sub: false,
            is_mod: false,
            is_owner: false,
            is_staff: false,
        };
    };

    const BIND_MUTATION_OBSERVER = () => {
        const targetNode = GET_CHAT_CONTAINER();

        if (targetNode === null) {
            return false;
        }

        if (document.querySelector(".sneed-chat-container") !== null) {
            console.log("[SNEED] Chat container already bound, aborting.");
            return false;
        }

        targetNode.classList.add("sneed-chat-container");

        const observer = new MutationObserver(MUTATION_OBSERVE);
        observer.observe(targetNode, {
            childList: true,
            attributes: false,
            subtree: false
        });

        GET_EXISTING_MESSAGES();
        return true;
    };

    const MUTATION_OBSERVE = (mutationList, observer) => {
        for (const mutation of mutationList) {
            if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
                const messages = HANDLE_MESSAGES(mutation.addedNodes);
                if (messages.length > 0) {
                    SEND_MESSAGES(messages);
                }
            }
        }
    };

    const SEND_MESSAGES = (messages) => {
        // check if socket is open
        if (CHAT_SOCKET.readyState === WebSocket.OPEN) {
            CHAT_SOCKET.send(JSON.stringify(messages));
        }
        else {
            // add to queue if not
            messages.forEach((message) => {
                MESSAGE_QUEUE.push(messages);
            });
        }
    };

    setInterval(function () {
        if (document.querySelector(".sneed-chat-container") === null) {
            console.log("[SNEED] Binding chat container.")
            BIND_MUTATION_OBSERVER();
        }
    }, 1000);


    //
    // Specific Implementations
    //

    const GET_CHAT_CONTAINER = () => {
        return document.querySelector("#chatroom .overflow-y-scroll");
    };

    const GET_EXISTING_MESSAGES = () => {
        console.log("[SNEED] Checking for existing messages.");
        const nodes = document.querySelectorAll(".sneed-chat-container .chat-history--row");

        if (nodes.length > 0) {
            const messages = HANDLE_MESSAGES(nodes);
            if (messages.length > 0) {
                SEND_MESSAGES(messages);
            }
        }
    };

    const HANDLE_MESSAGES = (nodes) => {
        const messages = [];

        nodes.forEach((node) => {
            // Kick actually has its own UUID parameter, generously.
            switch (node.dataset.chatEntry ?? '') {
                case 'history_breaker': break;
                case '': break;
                default:
                    let message = CREATE_MESSAGE();
                    message.id = node.dataset.chatEntry;
                    message.platform = "Kick";
                    // Kick has no avatars. I'll just use the favicon.
                    message.avatar = document.querySelector("link[rel='apple-touch-icon-precomposed'][sizes='144x144']").href;

                    const userEl = node.querySelector(".chat-entry-username");
                    const textEl = node.querySelector(".chat-entry-content");
                    const emoteEl = node.querySelector(".chat-emote");

                    message.username = userEl ? userEl.innerText.trim() : "";
                    message.message = "";
                    message.message += textEl ? textEl.innerHTML.trim() : "";
                    message.message += emoteEl ? emoteEl.outerHTML.trim() : "";

                    if (userEl === null) {
                        console.log("No username?", node);
                    }

                    // I don't know if these attributes change occasionally or if they're mostly static.
                    message.is_owner = node.querySelector("[data-v-1c3105ea]") !== null;
                    message.is_mod = node.querySelector("[data-v-43d962e8]") !== null;
                    message.is_sub = node.querySelector("[data-v-df7f331e]") !== null;

                    messages.push(message);
                    break;
            };
        });

        return messages;
    };
})();


// Kick message (chat emote)
//
//<div data-v-5e52272e="" data-chat-entry="90ba6e13-5155-4627-a3d6-e57f88ef2e86" class="mt-0.5">
//  <div class="chat-entry">
//    <!---->
//    <div>
//      <!---->
//      <!---->
//      <span data-v-bb151e01="" class="chat-message-identity">
//        <span data-v-bb151e01="" class="inline-flex translate-y-[3px]"></span>
//        <span data-v-b433ad78="" data-v-bb151e01="" class="chat-entry-username" data-chat-entry-user="rsturbo" data-chat-entry-user-id="4425316" style="color: rgb(188, 102, 255);">RSTurbo</span>
//      </span>
//      <span class="font-bold text-white">: </span>
//      <span data-v-89ba08de="">
//        <div data-v-31c262c8="" data-v-89ba08de="" class="chat-emote-container">
//          <div data-v-31c262c8="" class="relative">
//            <img data-v-31c262c8="" data-emote-name="KEKW" data-emote-id="37226" src="https://files.kick.com/emotes/37226/fullsize" alt="KEKW" class="chat-emote"></div>
//        </div>
//      </span>
//      <!---->
//    </div>
//    <!---->
//  </div>
//</div>
//
//<div data-v-5e52272e="" data-chat-entry="90ba6e13-5155-4627-a3d6-e57f88ef2e86" class="mt-0.5">
//  <div class="chat-entry">
//    <!---->
//    <div>
//      <!---->
//      <!---->
//      <span data-v-bb151e01="" class="chat-message-identity">
//        <span data-v-bb151e01="" class="inline-flex translate-y-[3px]"></span>
//        <span data-v-b433ad78="" data-v-bb151e01="" class="chat-entry-username" data-chat-entry-user="rsturbo" data-chat-entry-user-id="4425316" style="color: rgb(188, 102, 255);">RSTurbo</span>
//      </span>
//      <span class="font-bold text-white">: </span>
//      <span data-v-89ba08de="" class="chat-entry-content">Its Lil durks</span>
//      <!---->
//    </div>
//    <!---->
//  </div>
//</div>


