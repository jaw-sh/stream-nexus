// ==UserScript==
// @name S.N.E.E.D. (Odysee)
// @version 1.0.0
// @description Stream Nexus userscript for Odysee chat.
// @license BSD-3-Clause
// @author Joshua Moon <josh@josh.rs>
// @homepageURL https://github.com/jaw-sh/stream-nexus
// @supportURL https://github.com/jaw-sh/stream-nexus/issues
// @include https://odysee.com/*
// @include https://odysee.com/$/popout/*
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
    // Fetch Monkeypatch
    //
    if (fetch.sneed_patched === undefined) {
        console.log("[SNEED] Monkeypatching fetch");
        fetch.oldFetchImpl = fetch;
        fetch = function (input, init) {
            return fetch.oldFetchImpl(input, init).then(function (response) {
                if (response.url.includes("api/v2?m=comment.List")) {
                    response.clone().json().then(function (json) {
                        const messages = HANDLE_MESSAGES(json.result.items.reverse());
                        if (messages.length > 0) {
                            SEND_MESSAGES(messages);
                        }
                    });
                }
                return response;
            });
        };
        fetch.sneed_patched = true;
    }

    //
    // WebSocket Monkeypatch
    //
    if (WebSocket.prototype.send.sneed_patched === undefined) {
        console.log("[SNEED] Monkeypatching WebSocket");
        WebSocket.prototype.oldSendImpl = WebSocket.prototype.send;
        WebSocket.prototype.send = function (data) {
            this.oldSendImpl(data);
            if (this.sneed_patched === undefined) {
                this.sneed_patched = true;
                this.addEventListener("message", function (msg) {
                    let messages = HANDLE_MESSAGES(JSON.parse(msg.data));
                    if (messages.length > 0) {
                        SEND_MESSAGES(messages);
                    }
                }, false);
            }
        };
        WebSocket.prototype.send.sneed_patched = true;
    }

    //
    // Socket Logic
    //
    let CHAT_SOCKET = new WebSocket("ws://127.0.0.2:1350/chat.ws");
    const reconnect = () => {
        // check if socket is connected
        if (CHAT_SOCKET.readyState === WebSocket.OPEN || CHAT_SOCKET.readyState === WebSocket.CONNECTING) {
            return true;
        }
        else {
            // attempt to connect if disconnected
            CHAT_SOCKET = new WebSocket("ws://127.0.0.2:1350/chat.ws");
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
        return document.querySelector(".livestream__comments");
    };

    const GET_EXISTING_MESSAGES = () => {
        console.log("[SNEED] Checking for existing messages.");
        const nodes = document.querySelectorAll(".sneed-chat-container .livestream__comment");
        if (nodes.length > 0) {
            const list = Array.prototype.slice.call(nodes);
            const messages = HANDLE_MESSAGES(list.reverse());
            if (messages.length > 0) {
                SEND_MESSAGES(messages);
            }
        }
    };

    const HANDLE_MESSAGES = (nodes) => {
        const messages = [];

        nodes.forEach((node) => {
            // Note about Odysee:
            // The DOM changes in realtime because for some reason the initial HTML gets modified a lot by JS.
            // Odysee's UI in general is very sluggish so a lot changes.
            // In particular, avatars appear to be GIF images that are frozen after a short time.
            const message = CREATE_MESSAGE();
            message.platform = "Odysee";
            message.sent_at = Date.parse(node.querySelector(".date_time").getAttribute("title"));

            // in strange conditions this can be null, I do not know why.
            const avatar = node.querySelector(".channel-thumbnail__custom, .freezeframe-img")?.src;
            if (typeof avatar === "string" && avatar.length > 0) {
                message.avatar = avatar;
            }
            message.username = node.querySelector(".comment__author").innerText;
            const messageEl = node.querySelector(".livestream-comment__text .markdown-preview");
            message.message = messageEl ? messageEl.innerText : "";

            const creditEl = node.querySelector(".credit-amount");
            if (creditEl !== null) {
                const amount = creditEl.innerText;
                // Ignore LBRY for now.
                if (amount.includes("$")) {
                    message.currency = "USD";
                    message.amount = parseFloat(amount.replace("$", ""));
                    console.log("Superchat!", message);
                }
            }

            if (node.querySelector(".icon--BadgeMod")) {
                message.is_mod = true;
            }
            if (node.querySelector(".icon--BadgeStreamer")) {
                message.is_owner = true;
            }

            console.log(message);
            messages.push(message);
        });

        return messages;
    };
})();

// wss://sockety.odysee.tv/ws/commentron?id=d826937ad9bf3b7991eada5034c4612389583bc1&category=@RT:fd&sub_category=viewer
// {"type":"viewers","data":{"connected":150}}

// https://comments.odysee.tv/api/v2?m=comment.List
//{
//    "jsonrpc": "2.0",
//    "result": {
//        "page": 1,
//        "page_size": 75,
//        "total_pages": 1542,
//        "total_items": 115627,
//        "total_filtered_items": 115627,
//        "items": [
//            {
//                "comment": "I will mobilize my people to protect Serbia, stay united against the saxon tricks.",
//                "comment_id": "f162fd3621908ca512a84e4690d4325806b92d921001fb69653c9a36aca6c491",
//                "claim_id": "d826937ad9bf3b7991eada5034c4612389583bc1",
//                "timestamp": 1703449568,
//                "signature": "bcbf2e21adff5c10814f9e825047840865c2063ab4f487c1cdbbda63404865110c0ae9ff35bf09acf395003068b6304ad7ff86c53033dd2dc8bb46c4ea4217b9",
//                "signing_ts": "1703449568",
//                "channel_id": "e074a4dcf3ad7a25be35532ebc2b8986ed1e1cca",
//                "channel_name": "@Rkhnswt",
//                "channel_url": "lbry://@Rkhnswt#e074a4dcf3ad7a25be35532ebc2b8986ed1e1cca",
//                "currency": "",
//                "support_amount": 0,
//                "is_hidden": false,
//                "is_pinned": false,
//                "is_fiat": false,
//                "is_protected": false
//            },

// https://comments.odysee.tv/api/v2?m=comment.SuperChatList
//{
//    "jsonrpc": "2.0",
//    "result": {
//        "page": 1,
//        "page_size": 100,
//        "total_pages": 1,
//        "total_items": 21,
//        "total_amount": 287.5866,
//        "items": [
//            {
//                "comment": ":illuminati_1: :illuminati_1: :alien: :blind: :flying_saucer: ",
//                "comment_id": "a6e1ad9b72fdd542872465f2b3af1377a9acbb7a27b0fa0fbe79ceccad3b220f",
//                "claim_id": "d826937ad9bf3b7991eada5034c4612389583bc1",
//                "timestamp": 1689526618,
//                "signature": "b2eb8a5dbe0f56a7fb0b7f4fa6d882f46b875773b658bc9dc52de9d74003e6f9183f7a9c9fb3d1f2170ee5036b5973a899b0f9ee20d1f8f279b7d46140096dd8",
//                "signing_ts": "1689526618",
//                "channel_id": "8c96eea49623f07ecec581e12c89645eef19fd30",
//                "channel_name": "@Amazing",
//                "channel_url": "lbry://@Amazing#8c96eea49623f07ecec581e12c89645eef19fd30",
//                "currency": "",
//                "support_amount": 100,
//                "is_hidden": false,
//                "is_pinned": false,
//                "is_fiat": false,
//                "is_protected": false
//            },

// wss://sockety.odysee.tv/ws/commentron?id=d826937ad9bf3b7991eada5034c4612389583bc1&category=@RT:fd&sub_category=viewer
// {"type":"delta","data":{"comment":{"channel_id":"9cd7e06ab756fbdbed12954b84f4353560b59dea","channel_name":"@madd","channel_url":"lbry://@madd#9cd7e06ab756fbdbed12954b84f4353560b59dea","claim_id":"d826937ad9bf3b7991eada5034c4612389583bc1","comment":"lol","comment_id":"d771a55de0787f2fec52d77f7add213a429ea138b3f0c22220a4fbc8b3089799","currency":"","is_fiat":false,"is_hidden":false,"is_pinned":false,"is_protected":false,"signature":"c8fcaad31b42d764037336970d180f78b85aba965cca88fec71da1854cbc107e7e0bc104e7ce5431515d17d99fdd22cf7924567840f32f6a891651f66090ec29","signing_ts":"1703726326","support_amount":0,"timestamp":1703726327}}}

// <li class="livestream__comment">
//    <div class="livestream-comment__body">
//       <div class="channel-thumbnail channel-thumbnail__default--3 channel-thumbnail--xsmall"><img class="channel-thumbnail__custom" loading="lazy" src="https://thumbnails.odycdn.com/optimize/s:160:160/quality:85/plain/https://spee.ch/spaceman-png:2.png" style="visibility: visible;"></div>
//       <div class="livestream-comment__info">
//          <div class="livestream-comment__meta-information">
//             <button aria-expanded="false" aria-haspopup="true" aria-controls="menu--6430" class="button--uri-indicator comment__author" data-reach-menu-button="" type="button" id="menu-button--menu--6430">Schmuck</button>
//             <a class="button button--no-style" href="/$/premium">
//                <span class="button__content">
//                   <span class="comment__badge" aria-label="Premium+">
//                      <svg size="40" class="icon icon--PremiumPlus" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 35 30" width="40" height="40" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></svg>
//                   </span>
//                </span>
//             </a>
//             <span class="date_time" title="July 20, 2023 08:32 PM">1 minute ago</span>
//          </div>
//          <div class="livestream-comment__text">
//             <div dir="auto" class="notranslate markdown-preview">
//                <p><button aria-expanded="false" aria-haspopup="true" aria-controls="menu--6431" class="menu__button" data-reach-menu-button="" type="button" id="menu-button--menu--6431">@François_Le_Châtain</button> Sounds much like the movie GARP</p>
//             </div>
//          </div>
//       </div>
//    </div>
//    <div class="livestream-comment__menu">
//       <button aria-expanded="false" aria-haspopup="true" aria-controls="menu--6432" class="menu__button" data-reach-menu-button="" type="button" id="menu-button--menu--6432">
//          <svg size="18" class="icon icon--MoreVertical" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>
//       </button>
//    </div>
// </li>
//
//
// $USD Superchat
//
// <li class="livestream__comment livestream__comment--hyperchat">
//     <div class="livestream-comment__hyperchat-banner">
//         <span title="1" class="credit-amount-wrapper hyperChat">
//             <span class="credit-amount">
//                 <p style="display: inline;">$1.00</p>
//             </span>
//         </span>
//     </div>
//     <div class="livestream-comment__body">
//         <div class="channel-thumbnail channel-thumbnail--xsmall freezeframe-wrapper">
//             <div class="ff-container ff-responsive ff-ready ff-inactive">
//                 <canvas class="ff-canvas ff-canvas-ready" width="64" height="64"> </canvas>
//                 <img class="freezeframe-img ff-image" src="https://thumbnails.odycdn.com/optimize/s:64:0/quality:95/plain/https://thumbs.odycdn.com/99bb5917edaae46dbecfce94512d9601.webp" style="background-image: url(&quot;&quot;);">
//             </div>
//         </div>
//         <div class="livestream-comment__info">
//             <div class="livestream-comment__meta-information"><button aria-expanded="false" aria-haspopup="true" aria-controls="menu--15248" class="button--uri-indicator comment__author" data-reach-menu-button="" type="button" id="menu-button--menu--15248">@Castoreum</button><span class="date_time" title="September 5, 2023 01:21 PM">7 minutes ago</span></div>
//             <div class="livestream-comment__text">
//                 <div dir="auto" class="notranslate markdown-preview">
//                     <p>whoosh</p>
//                 </div>
//             </div>
//         </div>
//     </div>
//     <div class="livestream-comment__menu">
//         <button aria-expanded="false" aria-haspopup="true" aria-controls="menu--15249" class="menu__button" data-reach-menu-button="" type="button" id="menu-button--menu--15249">
//             <svg size="18" class="icon icon--MoreVertical" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
//                 <g>
//                     <circle cx="12" cy="5" r="1"></circle>
//                     <circle cx="12" cy="12" r="1"></circle>
//                     <circle cx="12" cy="19" r="1"></circle>
//                 </g>
//             </svg>
//         </button>
//     </div>
// </li>
//
//
// $LBRY Superchat
//
// <li class="livestream__comment livestream__comment--hyperchat">
//     <div class="livestream-comment__hyperchat-banner">
//         <span title="5" class="credit-amount-wrapper hyperChat">
//             <span class="credit-amount">
//                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="black" stroke="currentColor" stroke-width="0" stroke-linecap="round" stroke-linejoin="round" class="icon icon--LBC icon__lbc icon__lbc--after-text" aria-hidden="true">
//                     <path d="M1.03125 14.1562V9.84375L12 0L22.9688 9.84375V14.1562L12 24L1.03125 14.1562Z"></path>
//                     <path d="M8.925 10.3688L3.99375 14.8125L7.70625 18.15L12.6375 13.7063L8.925 10.3688Z"></path>
//                     <path d="M8.925 10.3688L15.1312 4.80005L12 1.98755L2.60625 10.425V13.575L3.99375 14.8125L8.925 10.3688Z"></path>
//                     <path d="M8.925 10.3688L3.99375 14.8125L7.70625 18.15L12.6375 13.7063L8.925 10.3688Z" fill="url(#paint0_linear07dfd500-efdf-4633-8826-4fd337e086b2)"></path>
//                     <path d="M8.925 10.3688L15.1312 4.80005L12 1.98755L2.60625 10.425V13.575L3.99375 14.8125L8.925 10.3688Z" fill="url(#paint1_linear07dfd500-efdf-4633-8826-4fd337e086b2)"></path>
//                     <path d="M15.075 13.6313L20.0062 9.1876L16.2937 5.8501L11.3625 10.2938L15.075 13.6313Z" fill="url(#paint2_linear07dfd500-efdf-4633-8826-4fd337e086b2)"></path>
//                     <path d="M15.075 13.6312L8.86875 19.2L12 22.0125L21.3937 13.575V10.425L20.0062 9.1875L15.075 13.6312Z" fill="url(#paint3_linear07dfd500-efdf-4633-8826-4fd337e086b2)"></path>
//                     <defs>
//                         <linearGradient id="paint0_linear07dfd500-efdf-4633-8826-4fd337e086b2" x1="3.7206" y1="14.2649" x2="15.1645" y2="14.2649" gradientUnits="userSpaceOnUse">
//                             <stop offset="0.2464" stop-color="#E700FF"></stop>
//                             <stop offset="0.3166" stop-color="#E804F9"></stop>
//                             <stop offset="0.4108" stop-color="#E90EE8"></stop>
//                             <stop offset="0.5188" stop-color="#EC1FCC"></stop>
//                             <stop offset="0.637" stop-color="#F037A5"></stop>
//                             <stop offset="0.7635" stop-color="#F45672"></stop>
//                             <stop offset="0.8949" stop-color="#FA7A36"></stop>
//                             <stop offset="1" stop-color="#FF9B00"></stop>
//                         </linearGradient>
//                         <linearGradient id="paint1_linear07dfd500-efdf-4633-8826-4fd337e086b2" x1="2.60274" y1="8.40089" x2="15.14" y2="8.40089" gradientUnits="userSpaceOnUse">
//                             <stop offset="0.4233" stop-color="#FABD09"></stop>
//                             <stop offset="0.8292" stop-color="#FA6B00"></stop>
//                         </linearGradient>
//                         <linearGradient id="paint2_linear07dfd500-efdf-4633-8826-4fd337e086b2" x1="6.8682" y1="14.1738" x2="25.405" y2="4.84055" gradientUnits="userSpaceOnUse">
//                             <stop stop-color="#BAFF8E"></stop>
//                             <stop offset="0.6287" stop-color="#008EBB"></stop>
//                         </linearGradient>
//                         <linearGradient id="paint3_linear07dfd500-efdf-4633-8826-4fd337e086b2" x1="25.2522" y1="6.08799" x2="3.87697" y2="27.836" gradientUnits="userSpaceOnUse">
//                             <stop stop-color="#BAFF8E"></stop>
//                             <stop offset="0.6287" stop-color="#008EBB"></stop>
//                         </linearGradient>
//                         <clipPath id="clip0">
//                             <rect width="24" height="24" fill="white"></rect>
//                         </clipPath>
//                     </defs>
//                 </svg>
//                 5
//             </span>
//         </span>
//     </div>
//     <div class="livestream-comment__body">
//         <div class="channel-thumbnail channel-thumbnail--xsmall"><img class="channel-thumbnail__custom" loading="lazy" src="https://thumbnails.odycdn.com/optimize/s:64:0/quality:95/plain/https://spee.ch/3/ecd2cbf1b977016d.jpg" style="visibility: visible;"></div>
//         <div class="livestream-comment__info">
//             <div class="livestream-comment__meta-information"><button aria-expanded="false" aria-haspopup="true" aria-controls="menu--24646" class="button--uri-indicator comment__author" data-reach-menu-button="" type="button" id="menu-button--menu--24646">Mad at the Internet</button><span class="date_time" title="September 5, 2023 11:37 AM">1 minute ago</span></div>
//             <div class="livestream-comment__text">
//                 <div dir="auto" class="notranslate markdown-preview">
//                     <p>Testing an Odysee integration.</p>
//                 </div>
//             </div>
//         </div>
//     </div>
//     <div class="livestream-comment__menu">
//         <button aria-expanded="false" aria-haspopup="true" aria-controls="menu--24647" class="menu__button" data-reach-menu-button="" type="button" id="menu-button--menu--24647">
//             <svg size="18" class="icon icon--MoreVertical" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
//                 <g>
//                     <circle cx="12" cy="5" r="1"></circle>
//                     <circle cx="12" cy="12" r="1"></circle>
//                     <circle cx="12" cy="19" r="1"></circle>
//                 </g>
//             </svg>
//         </button>
//     </div>
// </li>
