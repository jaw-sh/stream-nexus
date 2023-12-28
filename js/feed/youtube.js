// ==UserScript==
// @name S.N.E.E.D. (YouTube)
// @version 1.0.0
// @description Stream Nexus userscript for Rumble chat.
// @license BSD-3-Clause
// @author Joshua Moon <josh@josh.rs>
// @homepageURL https://github.com/jaw-sh/stream-nexus
// @supportURL https://github.com/jaw-sh/stream-nexus/issues
// @include https://www.youtube.com/watch?v=*
// @include https://www.youtube.com/live/*
// @include https://www.youtube.com/live_chat?v=*
// @include https://www.youtube.com/live_chat?is_popout=1&v=*
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

//
// Monkeypatch Fetch
//
setInterval(() => {
    // I tried very hard to get this to play nice, but YouTube has its own fetch monkeypatch and they just do not get along.
    const windowFetch = window.fetch;
    if (windowFetch.sneed_yt_monkeypatch_fetch !== true) {
        console.log("[SNEED] Monkeypatching fetch()")
        const newFetch = async (url, options, ...args) => {
            console.log("[SNEED] Monkeypatched fetch.", this);
            return windowFetch(url, options, ...args);
        };
        newFetch.sneed_yt_monkeypatch_fetch = true;
        window.fetch = newFetch;
    }
}, 1000);

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
        console.log("[SNEED::YouTube] Socket connection established.");
        SEND_MESSAGES(MESSAGE_QUEUE);
        MESSAGE_QUEUE = [];
    });

    CHAT_SOCKET.addEventListener("close", (event) => {
        console.log("[SNEED::YouTube] Socket has closed. Attempting reconnect.", event);
        setTimeout(function () { reconnect(); }, 3000);
    });

    CHAT_SOCKET.addEventListener("error", (event) => {
        console.log("[SNEED::YouTube] Socket has errored. Closing.", event.reason);
        alert("The SNEED chat socket could not connect. Ensure the web server is running and that Brave shields are off.");
        socket.close();
    });

    //
    // Chat Messages
    //
    var MESSAGE_QUEUE = [];

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
            console.log("[SNEED::YouTube] No chat container found.")
            return false;
        }

        if (document.querySelector(".sneed-chat-container") !== null) {
            console.log("[SNEED::YouTube] Chat container already bound, aborting.");
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

    setInterval(() => {
        if (document.querySelector(".sneed-chat-container") !== null)
            return;
        // YT-Specific: Enforce live chat.
        if (YOUTUBE_LIVE_CHAT()) {
            const chatContainer = GET_CHAT_CONTAINER();
            if (chatContainer !== null && !chatContainer.classList.contains("sneed-chat-container")) {
                console.log("[SNEED::YouTube] Binding chat container.");
                BIND_MUTATION_OBSERVER();
            }
        }
    }, 1000);


    //
    // Specific Implementations
    //

    // Attempts to switch to Live Chat from Top Chat.
    // Returns TRUE if we can proceed to checking the MutationObserver is wokring.
    // Returns FALSE if the chat isn't found.
    const YOUTUBE_LIVE_CHAT = () => {
        const chatContainer = GET_CHAT_CONTAINER();

        if (chatContainer === null) {
            console.log("[SNEED::YouTube] Awaiting live chat container...");
            return false;
        }

        const chatApp = chatContainer.closest("yt-live-chat-app");
        const dropdownEl = chatApp.querySelector("#label.yt-dropdown-menu");
        const liveEl = chatApp.querySelectorAll("#item-with-badge.yt-dropdown-menu")[1];

        if (dropdownEl === null || liveEl === undefined) {
            console.log("[SNEED::YouTube] No live chat dropdown menu.");
            console.log(dropdownEl, liveEl);
            return false;
        }

        if (dropdownEl.textContent.trim() === liveEl.textContent.trim())
            return true; // We're already live chat.

        liveEl.closest("a").click();
        console.log("[SNEED::YouTube] Live chat activated. Eat it, Neal!");
        return true;
    }

    const GET_CHAT_CONTAINER = () => {
        const chatFrame = document.querySelector("#chatframe.ytd-live-chat-frame");
        const targetDoc = chatFrame === null ? document : chatFrame.contentWindow.document;
        return targetDoc.querySelector("#items.yt-live-chat-item-list-renderer");
    };

    const GET_EXISTING_MESSAGES = () => {
        console.log("[SNEED::YouTube] Checking for existing messages.");
        const nodes = GET_CHAT_CONTAINER().childNodes;

        if (nodes.length > 0) {
            const messages = HANDLE_MESSAGES(nodes);
            if (messages.length > 0) {
                SEND_MESSAGES(messages);
            }
        }
    }

    const HANDLE_MESSAGES = (nodes) => {
        const messages = [];

        nodes.forEach((node) => {
            const tag = node.tagName.toLowerCase();
            if (!(tag === "yt-live-chat-text-message-renderer" || tag === "yt-live-chat-paid-message-renderer"))
                return;

            let message = CREATE_MESSAGE();
            message.platform = "YouTube";
            message.received_at = Date.now(); // Rumble provides no information.

            message.avatar = node.querySelector("yt-img-shadow img").src;
            message.username = node.querySelector("[id='author-name']").innerText;
            message.message = node.querySelector("[id='message']").innerHTML;

            if (tag === "yt-live-chat-paid-message-renderer") {
                const dono = node.querySelector("#purchase-amount").innerText;
                const amt = dono.replace(/[^0-9.-]+/g, "");
                message.amount = Number(amt);
                // get index of first number or whitespace in dono
                //const currency = dono.substring(0, dono.indexOf(" ")).trim();
                const currency = dono.split(/[0-9 ]/)[0].trim();

                // ## TODO ## YT superchats are MANY currencies.
                const currencyMap = {
                    // "$": "USD",
                    "US$": "USD", // Looks like it's US$ now.
                    "CA$": "CAD",
                    "C$": "NIO", // I think this is Nicaraguan Cordoba and not Canadian Dollar.
                    "A$": "AUD",
                    "NZ$": "NZD",
                    "NT$": "TWD",
                    "R$": "BRL",
                    "MX$": "MXN",
                    "HK$": "HKD",
                    "£": "GBP",
                    "€": "EUR",
                    "₽": "RUB",
                    "₹": "INR",
                    "¥": "JPY",
                    "₩": "KRW",
                    "₱": "PHP",
                    "₫": "VND",
                };

                if (currencyMap[currency] === undefined)
                    message.currency = currency.length === 3 ? currency : (() => {
                        console.error("[SNEED::YouTube] Unknown currency:", currency);
                        return "ZWD";
                    });
                else
                    message.currency = currencyMap[currency];
            }

            // The owner and subs come from a top-level [author-type].
            const authorType = node.getAttribute("author-type");
            if (typeof authorType === "string") {
                if (authorType.includes("owner")) {
                    message.is_owner = true;
                }
                if (authorType.includes("moderator")) {
                    message.is_mod = true;
                }
                if (authorType.includes("member")) {
                    message.is_sub = true;
                }
            }

            // "Verified" is exclusively denominated by a badge, but other types can be found that way too.
            // Whatever, just check the badges too.
            node.querySelectorAll("yt-live-chat-author-badge-renderer.yt-live-chat-author-chip").forEach((badge) => {
                switch (badge.getAttribute("type")) {
                    case "moderator": message.is_mod = true; break;
                    case "verified": message.is_verified = true; break;
                    case "member": message.is_sub = true; break;

                }
                // I don't think YouTube staff will ever use live chat?
            });

            messages.push(message);
        });

        return messages;
    };
})();

// These updates flood continuously during livechat.
// https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8&prettyPrint=false
//{
//    "responseContext": {
//        "serviceTrackingParams": [
//            {
//                "service": "CSI",
//                "params": [
//                    {
//                        "key": "c",
//                        "value": "WEB"
//                    },
//                    {
//                        "key": "cver",
//                        "value": "2.20231219.04.00"
//                    },
//                    {
//                        "key": "yt_li",
//                        "value": "1"
//                    },
//                    {
//                        "key": "GetLiveChat_rid",
//                        "value": "0x913245056f88e7ca"
//                    }
//                ]
//            },
//            {
//                "service": "GFEEDBACK",
//                "params": [
//                    {
//                        "key": "logged_in",
//                        "value": "1"
//                    },
//                    {
//                        "key": "e",
//                        "value": "23804281,23885490,23946420,23966208,23983296,23986019,23998056,24004644,24007246,24034168,24036948,24077241,24080738,24108447,24120819,24135310,24140247,24166867,24181174,24187377,24208765,24241378,24255543,24255545,24260378,24288664,24290971,24367580,24367698,24377598,24377909,24382552,24385728,24387949,24390675,24428788,24428941,24428945,24439361,24451319,24453989,24458839,24468724,24485421,24495712,24506515,24515423,24518452,24524098,24525811,24526642,24526770,24526787,24526794,24526801,24526804,24526811,24526827,24528552,24528557,24528577,24528584,24528644,24528647,24528659,24528668,24531225,24531254,24537200,24539025,24542367,24542452,24546059,24546075,24548627,24548629,24549786,24550458,24559327,24559699,24560416,24561210,24561384,24566687,24589493,24589913,24694842,24697069,24698453,24699899,39324569,39325337,39325345,39325405,39325424,39325428,39325489,39325496,39325500,39325515,39325525,39325532,51003636,51004018,51006181,51009781,51009900,51010235,51012165,51012291,51012659,51014091,51014900,51016856,51017346,51019626,51020570,51021953,51025415,51026715,51026824,51027870,51028271,51029412,51030101,51031341,51032410,51033399,51033577,51035288,51035885,51036473,51036511,51037344,51037349,51037540,51037819,51037893,51038399,51038518,51038805,51039200,51039493,51041282,51041331,51041497,51043948,51045885,51045889,51045969,51046754,51047534,51048240,51048279,51049006,51050361,51052759,51053689,51055129,51055136,51055564,51056261,51056270,51057501,51057534,51057746,51057811,51057822,51057848,51057857,51057863,51059545,51059572,51059972,51060895,51061018,51061487,51063125,51063136,51063147,51063154,51063643,51064006,51064281,51064594,51065651,51065706,51068869,51069088,51069269,51069838,51070203,51070732,51072103,51072447,51072748,51073619,51074062,51074183,51074391,51074608,51074662,51074717,51074739,51075839,51076209,51077149,51078193,51079309,51079353,51080182,51080510,51080714,51080903,51081382,51082368,51083014,51083234,51083862,51084277,51084290,51084589,51084695,51086857,51090887"
//                    }
//                ]
//            },
//            {
//                "service": "GUIDED_HELP",
//                "params": [
//                    {
//                        "key": "logged_in",
//                        "value": "1"
//                    }
//                ]
//            },
//            {
//                "service": "ECATCHER",
//                "params": [
//                    {
//                        "key": "client.version",
//                        "value": "2.20231219"
//                    },
//                    {
//                        "key": "client.name",
//                        "value": "WEB"
//                    },
//                    {
//                        "key": "client.fexp",
//                        "value": "24506515,51083234,24453989,51078193,24524098,51065651,51064594,24698453,51012291,51045889,51033577,51073619,24531225,24549786,39325337,51057848,51084277,51037540,24468724,51038518,51074662,24390675,51076209,51037893,51048240,24537200,51026824,24528644,39325525,51014900,51050361,24526642,24548629,39325532,51026715,24187377,51057746,39325500,39325428,51063154,51057811,51016856,24528584,24560416,51063147,24528577,51029412,51041331,51059572,51010235,23885490,51041282,51017346,51084695,51070732,51074183,24428945,51074608,39325405,24697069,51012165,24526827,24550458,51068869,24589493,51064281,24559699,51009900,51006181,24377598,51004018,51074062,51014091,51074717,24526804,51081382,51045885,24526811,39324569,51020570,24566687,51047534,51069838,24166867,51063136,51052759,51075839,51037819,24559327,24451319,24542452,24377909,51080903,24515423,51028271,24241378,24548627,51069269,24458839,24135310,24080738,51077149,51036511,51059972,51009781,51072447,51019626,51070203,51061487,24699899,23946420,51057863,51031341,24528557,51043948,24526787,24589913,24385728,24518452,24526794,51059545,51069088,24526801,24255543,51084290,24531254,23804281,24428941,51090887,24561384,51072103,39325489,51086857,24546059,51025415,39325345,39325496,39325424,51041497,51061018,51063125,24077241,24495712,51063643,51079309,51057501,51083862,51012659,24525811,39325515,51055136,51046754,23998056,51060895,24004644,51032410,24007246,24255545,51074391,24367580,24036948,24140247,51079353,51045969,51055129,24387949,24539025,51080510,24120819,51030101,23983296,24428788,51065706,24528668,51003636,51037349,51038399,24260378,51080714,24528647,24290971,23966208,51082368,51056270,51053689,24208765,24108447,51080182,51036473,24542367,51027870,51049006,24181174,51021953,51084589,51048279,51039493,24288664,23986019,51083014,24528659,51064006,51037344,51074739,51057534,51033399,51057857,24694842,24034168,24485421,24382552,51035288,51035885,51056261,51072748,24561210,24528552,51055564,51038805,24526770,24367698,24546075,51039200,24439361,51057822"
//                    }
//                ]
//            }
//        ],
//        "mainAppWebResponseContext": {
//            "datasyncId": "111825020563651229171||",
//            "loggedOut": false,
//            "trackingParam": "kV9fmPxhojXCz39TnrslLKPQSQR"
//        },
//        "webResponseContextExtensionData": {
//            "hasDecorated": true
//        }
//    },
//    "continuationContents": {
//        "liveChatContinuation": {
//            "continuations": [
//                {
//                    "invalidationContinuationData": {
//                        "invalidationId": {
//                            "objectSource": 1056,
//                            "objectId": "Y2hhdH5qZktmUGZ5SlJka341Njc4OTg4",
//                            "topic": "chat~jfKfPfyJRdk~5678988",
//                            "subscribeToGcmTopics": true,
//                            "protoCreationTimestampMs": "1703696414487"
//                        },
//                        "timeoutMs": 10000,
//                        "continuation": "0ofMyAObAhpeQ2lrcUp3b1lWVU5UU2pSbmExWkROazV5ZGtsSk9IVnRlblJtTUU5M0VndHFaa3RtVUdaNVNsSmtheG9UNnFqZHVRRU5DZ3RxWmt0bVVHWjVTbEprYXlBQk1BQSUzRCiuotbbi7CDAzAAQAJKcggBGAAgAEoKCAEQABgAIAAwAFD3tNqZi7CDA1gEeACiAQ8SCwiQsLGsBhDF6_NpGgCqARAQAhoCCAEiAggBKgQIABAAsAEAwAEAyAGSj_bVi7CDA-IBDAiRr7GsBhCZ7uO_A-gBAPABAPgBAIgCAJACAFDGtorci7CDA1iSkcS1_amDA4IBBAgEGAGIAQCaAQIIAKAByuTc3IuwgwOyAQC6AQIICtABhLCxrAY%3D"
//                    }
//                }
//            ],
//            "actions": [
//                {
//                    "addChatItemAction": {
//                        "item": {
//                            "liveChatTextMessageRenderer": {
//                                "message": {
//                                    "runs": [
//                                        {
//                                            "text": "@tsunami "
//                                        },
//                                        {
//                                            "emoji": {
//                                                "emojiId": "💀",
//                                                "shortcuts": [
//                                                    ":skull:"
//                                                ],
//                                                "searchTerms": [
//                                                    "skull"
//                                                ],
//                                                "image": {
//                                                    "thumbnails": [
//                                                        {
//                                                            "url": "https://www.youtube.com/s/gaming/emoji/0f0cae22/emoji_u1f480.svg"
//                                                        }
//                                                    ],
//                                                    "accessibility": {
//                                                        "accessibilityData": {
//                                                            "label": "💀"
//                                                        }
//                                                    }
//                                                }
//                                            }
//                                        }
//                                    ]
//                                },
//                                "authorName": {
//                                    "simpleText": "Chahd "
//                                },
//                                "authorPhoto": {
//                                    "thumbnails": [
//                                        {
//                                            "url": "https://yt4.ggpht.com/dWDyYvMhp6Qah4J0EGJZ_UffjPO99ZWZyNs84nu8Ybj-ig_8pIIipIc88yaG1gfAPaSFWKDG=s32-c-k-c0x00ffffff-no-rj",
//                                            "width": 32,
//                                            "height": 32
//                                        },
//                                        {
//                                            "url": "https://yt4.ggpht.com/dWDyYvMhp6Qah4J0EGJZ_UffjPO99ZWZyNs84nu8Ybj-ig_8pIIipIc88yaG1gfAPaSFWKDG=s64-c-k-c0x00ffffff-no-rj",
//                                            "width": 64,
//                                            "height": 64
//                                        }
//                                    ]
//                                },
//                                "contextMenuEndpoint": {
//                                    "commandMetadata": {
//                                        "webCommandMetadata": {
//                                            "ignoreNavigation": true
//                                        }
//                                    },
//                                    "liveChatItemContextMenuEndpoint": {
//                                        "params": "Q2g0S0hBb2FRMUJtWHpGT2RVeHpTVTFFUm1FMFVERm5RV1JEYjBWSWJGRWFLU29uQ2hoVlExTktOR2RyVmtNMlRuSjJTVWs0ZFcxNmRHWXdUM2NTQzJwbVMyWlFabmxLVW1ScklBRW9CRElhQ2hoVlExbFlWalp3TFY5bVNESk9NVzkzTlUwMFJYQlRVSGM0QWtnQVVBRSUzRA=="
//                                    }
//                                },
//                                "id": "ChwKGkNQZl8xTnVMc0lNREZhNFAxZ0FkQ29FSGxR",
//                                "timestampUsec": "1703696412283182",
//                                "authorExternalChannelId": "UCYXV6p-_fH2N1ow5M4EpSPw",
//                                "contextMenuAccessibility": {
//                                    "accessibilityData": {
//                                        "label": "Chat actions"
//                                    }
//                                }
//                            }
//                        },
//                        "clientId": "CPf_1NuLsIMDFa4P1gAdCoEHlQ"
//                    }
//                }
//            ]
//        }
//    }
//}

//
// https://www.youtube.com/live/UicP06m9IQY
// https://www.youtube.com/live_chat?is_popout=1&v=UicP06m9IQY
//
//
// These samples taken on 2023-JUL-19
//
// Regular Message
//
// <yt-live-chat-text-message-renderer class="style-scope yt-live-chat-item-list-renderer" modern="" id="ChwKGkNOaTg4ZnpzbTRBREZZdjJGZ2tkWDJZUHJ3" author-type="">
//   <!--css-build:shady-->
//   <!--css-build:shady-->
//   <yt-img-shadow id="author-photo" class="no-transition style-scope yt-live-chat-text-message-renderer" height="24" width="24" style="background-color: transparent;" loaded="">
//     <!--css-build:shady-->
//     <!--css-build:shady--><img id="img" draggable="false" class="style-scope yt-img-shadow" alt="" height="24" width="24" src="https://yt4.ggpht.com/ytc/AOPolaSlOaa0jzjlhZaoRZzT40ewoZHpvcwnSal4JGvtrQ=s64-c-k-c0x00ffffff-no-rj">
//   </yt-img-shadow>
//   <div id="content" class="style-scope yt-live-chat-text-message-renderer">
//     <span id="timestamp" class="style-scope yt-live-chat-text-message-renderer">5:47 PM</span>
//     <yt-live-chat-author-chip class="style-scope yt-live-chat-text-message-renderer">
//       <!--css-build:shady-->
//       <!--css-build:shady-->
//       <span id="prepend-chat-badges" class="style-scope yt-live-chat-author-chip"></span>
//       <span id="chat-badges" class="style-scope yt-live-chat-author-chip">
//         <yt-live-chat-author-badge-renderer class="style-scope yt-live-chat-author-chip" aria-label="Moderator" type="moderator" shared-tooltip-text="Moderator">
//           <!--css-build:shady--><!--css-build:shady-->
//           <div id="image" class="style-scope yt-live-chat-author-badge-renderer">
//             <yt-icon class="style-scope yt-live-chat-author-badge-renderer">
//               <!--css-build:shady--><!--css-build:shady-->
//               <yt-icon-shape class="style-scope yt-icon">
//                 <icon-shape class="yt-spec-icon-shape">
//                   <div style="width: 100%; height: 100%; fill: currentcolor;">
//                     <svg viewBox="0 0 16 16" focusable="false" style="pointer-events: none; display: block; width: 100%; height: 100%;">
//                       <path d="M9.64589146,7.05569719 C9.83346524,6.562372 9.93617022,6.02722257 9.93617022,5.46808511 C9.93617022,3.00042984 7.93574038,1 5.46808511,1 C4.90894765,1 4.37379823,1.10270499 3.88047304,1.29027875 L6.95744681,4.36725249 L4.36725255,6.95744681 L1.29027875,3.88047305 C1.10270498,4.37379824 1,4.90894766 1,5.46808511 C1,7.93574038 3.00042984,9.93617022 5.46808511,9.93617022 C6.02722256,9.93617022 6.56237198,9.83346524 7.05569716,9.64589147 L12.4098057,15 L15,12.4098057 L9.64589146,7.05569719 Z"></path>
//                     </svg>
//                   </div>
//                 </icon-shape>
//               </yt-icon-shape>
//             </yt-icon>
//           </div>
//         </yt-live-chat-author-badge-renderer>
//       </span>
//       <span id="author-name" dir="auto" class="moderator style-scope yt-live-chat-author-chip style-scope yt-live-chat-author-chip">
//         Nightbot
//         <span id="chip-badges" class="style-scope yt-live-chat-author-chip">
//           <yt-live-chat-author-badge-renderer class="style-scope yt-live-chat-author-chip" aria-label="Verified" type="verified" shared-tooltip-text="Verified">
//             <!--css-build:shady--><!--css-build:shady-->
//             <div id="image" class="style-scope yt-live-chat-author-badge-renderer">
//               <yt-icon class="style-scope yt-live-chat-author-badge-renderer">
//                 <!--css-build:shady--><!--css-build:shady-->
//                 <yt-icon-shape class="style-scope yt-icon">
//                   <icon-shape class="yt-spec-icon-shape">
//                     <div style="width: 100%; height: 100%; fill: currentcolor;">
//                       <svg viewBox="0 0 16 16" focusable="false" style="pointer-events: none; display: block; width: 100%; height: 100%;">
//                         <path transform="scale(0.66)" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"></path>
//                       </svg>
//                     </div>
//                   </icon-shape>
//                 </yt-icon-shape>
//               </yt-icon>
//             </div>
//           </yt-live-chat-author-badge-renderer>
//         </span>
//       </span>
//     </yt-live-chat-author-chip>&ZeroWidthSpace;<span id="message" dir="auto" class="style-scope yt-live-chat-text-message-renderer">hambone</span><span id="deleted-state" class="style-scope yt-live-chat-text-message-renderer"></span><a id="show-original" href="#" class="style-scope yt-live-chat-text-message-renderer"></a>
//   </div>
//   <div id="menu" class="style-scope yt-live-chat-text-message-renderer">
//     <yt-icon-button id="menu-button" class="style-scope yt-live-chat-text-message-renderer">
//       <!--css-build:shady-->
//       <!--css-build:shady--><button id="button" class="style-scope yt-icon-button" aria-label="Chat actions">
//         <yt-icon icon="more_vert" class="style-scope yt-live-chat-text-message-renderer">
//           <!--css-build:shady-->
//           <!--css-build:shady-->
//           <yt-icon-shape class="style-scope yt-icon">
//             <icon-shape class="yt-spec-icon-shape">
//               <div style="width: 100%; height: 100%; fill: currentcolor;"><svg enable-background="new 0 0 24 24" height="24" viewBox="0 0 24 24" width="24" focusable="false" style="pointer-events: none; display: block; width: 100%; height: 100%;">
//                   <path d="M12 16.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5zM10.5 12c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5-1.5.67-1.5 1.5zm0-6c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5-1.5.67-1.5 1.5z"></path>
//                 </svg></div>
//             </icon-shape>
//           </yt-icon-shape>
//         </yt-icon>
//       </button>
//       <yt-interaction id="interaction" class="circular style-scope yt-icon-button">
//         <!--css-build:shady-->
//         <!--css-build:shady-->
//         <div class="stroke style-scope yt-interaction"></div>
//         <div class="fill style-scope yt-interaction"></div>
//       </yt-interaction>
//     </yt-icon-button>
//   </div>
//   <div id="inline-action-button-container" class="style-scope yt-live-chat-text-message-renderer" aria-hidden="true">
//     <div id="inline-action-buttons" class="style-scope yt-live-chat-text-message-renderer"></div>
//   </div>
// </yt-live-chat-text-message-renderer>
//
//
// Paid Message
//
//<yt-live-chat-paid-message-renderer class="style-scope yt-live-chat-item-list-renderer" modern="" id="ChwKGkNJLUpqWUx0bTRBREZaMGIxZ0FkWEtvRHh3" allow-animations="" style="--yt-live-chat-paid-message-primary-color: rgba(0,229,255,1); --yt-live-chat-paid-message-secondary-color: rgba(0,184,212,1); --yt-live-chat-paid-message-header-color: rgba(0,0,0,1); --yt-live-chat-paid-message-timestamp-color: rgba(0,0,0,0.5019607843137255); --yt-live-chat-paid-message-color: rgba(0,0,0,1); --yt-live-chat-disable-highlight-message-author-name-color: rgba(0,0,0,0.7019607843137254);"><!--css-build:shady--><!--css-build:shady--><div id="card" class="style-scope yt-live-chat-paid-message-renderer">
//  <div id="header" class="style-scope yt-live-chat-paid-message-renderer">
//
//    <yt-img-shadow id="author-photo" height="40" width="40" class="style-scope yt-live-chat-paid-message-renderer no-transition" style="background-color: transparent;" loaded=""><!--css-build:shady--><!--css-build:shady-->
//      <img id="img" draggable="false" class="style-scope yt-img-shadow" alt="" height="40" width="40" src="https://yt4.ggpht.com/ytc/AOPolaSwvFOIx2wDgFqnNL-uiwWhPh-e3-kMRnRx6ymPlg=s64-c-k-c0x00ffffff-no-rj">
//     </yt-img-shadow>
//    <dom-if restamp="" class="style-scope yt-live-chat-paid-message-renderer"><template is="dom-if"></template></dom-if>
//    <dom-if class="style-scope yt-live-chat-paid-message-renderer"><template is="dom-if"></template></dom-if>
//    <dom-if restamp="" class="style-scope yt-live-chat-paid-message-renderer"><template is="dom-if"></template></dom-if>
//    <div id="header-content" class="style-scope yt-live-chat-paid-message-renderer">
//      <div id="header-content-primary-column" class="style-scope yt-live-chat-paid-message-renderer">
//        <div id="author-name-chip" class="style-scope yt-live-chat-paid-message-renderer">
//          <yt-live-chat-author-chip disable-highlighting="" class="style-scope yt-live-chat-paid-message-renderer"><!--css-build:shady--><!--css-build:shady--><span id="prepend-chat-badges" class="style-scope yt-live-chat-author-chip"></span><span id="author-name" dir="auto" class=" style-scope yt-live-chat-author-chip style-scope yt-live-chat-author-chip">Mike<span id="chip-badges" class="style-scope yt-live-chat-author-chip"></span></span><span id="chat-badges" class="style-scope yt-live-chat-author-chip"></span></yt-live-chat-author-chip>
//        </div>
//        <div id="purchase-amount-column" class="style-scope yt-live-chat-paid-message-renderer">
//          <yt-img-shadow id="currency-img" height="16" width="16" class="style-scope yt-live-chat-paid-message-renderer no-transition" hidden=""><!--css-build:shady--><!--css-build:shady--><img id="img" draggable="false" class="style-scope yt-img-shadow" alt="" height="16" width="16"></yt-img-shadow>
//          <div id="purchase-amount" class="style-scope yt-live-chat-paid-message-renderer">
//            <yt-formatted-string class="style-scope yt-live-chat-paid-message-renderer">CA$2.79</yt-formatted-string>
//          </div>
//        </div>
//      </div>
//      <span id="timestamp" class="style-scope yt-live-chat-paid-message-renderer">5:47 PM</span>
//      <div id="gradient-container" class="style-scope yt-live-chat-paid-message-renderer">
//        <div id="gradient" class="style-scope yt-live-chat-paid-message-renderer"></div>
//      </div>
//      <div id="menu" class="style-scope yt-live-chat-paid-message-renderer">
//        <yt-icon-button id="menu-button" class="style-scope yt-live-chat-paid-message-renderer"><!--css-build:shady--><!--css-build:shady--><button id="button" class="style-scope yt-icon-button" aria-label="Chat actions">
//          <yt-icon icon="more_vert" class="style-scope yt-live-chat-paid-message-renderer"><!--css-build:shady--><!--css-build:shady--><yt-icon-shape class="style-scope yt-icon"><icon-shape class="yt-spec-icon-shape"><div style="width: 100%; height: 100%; fill: currentcolor;"><svg enable-background="new 0 0 24 24" height="24" viewBox="0 0 24 24" width="24" focusable="false" style="pointer-events: none; display: block; width: 100%; height: 100%;"><path d="M12 16.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5zM10.5 12c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5-1.5.67-1.5 1.5zm0-6c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5-1.5.67-1.5 1.5z"></path></svg></div></icon-shape></yt-icon-shape></yt-icon>
//        </button><yt-interaction id="interaction" class="circular style-scope yt-icon-button"><!--css-build:shady--><!--css-build:shady--><div class="stroke style-scope yt-interaction"></div><div class="fill style-scope yt-interaction"></div></yt-interaction></yt-icon-button>
//      </div>
//      <div id="creator-heart-button" class="style-scope yt-live-chat-paid-message-renderer"></div>
//    </div>
//  </div>
//  <div id="content" class="style-scope yt-live-chat-paid-message-renderer">
//    <div id="message" dir="auto" class="style-scope yt-live-chat-paid-message-renderer">you skipped my dono to talk about sausage wtf</div>
//    <div id="input-container" class="style-scope yt-live-chat-paid-message-renderer">
//      <dom-if class="style-scope yt-live-chat-paid-message-renderer"><template is="dom-if"></template></dom-if>
//    </div>
//    <yt-formatted-string id="deleted-state" class="style-scope yt-live-chat-paid-message-renderer" is-empty=""><!--css-build:shady--><!--css-build:shady--><yt-attributed-string class="style-scope yt-formatted-string"></yt-attributed-string></yt-formatted-string>
//    <div id="footer" class="style-scope yt-live-chat-paid-message-renderer"></div>
//  </div>
//</div>
// <div id="lower-bumper" class="style-scope yt-live-chat-paid-message-renderer"></div>
// <div id="buy-flow-button" class="style-scope yt-live-chat-paid-message-renderer" hidden=""></div>
// <div id="inline-action-button-container" class="style-scope yt-live-chat-paid-message-renderer" aria-hidden="true">
//   <div id="inline-action-buttons" class="style-scope yt-live-chat-paid-message-renderer"></div>
// </div>
// </yt-live-chat-paid-message-renderer>
