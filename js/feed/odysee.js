window.SNEED_GET_CHAT_CONTAINER = () => {
    return document.querySelector(".livestream__comments");
}

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
// <li class="livestream__comment livestream__comment--hyperchat">
//    <div class="livestream-comment__hyperchat-banner">
//       <span title="0.05" class="credit-amount-wrapper hyperChat">
//          <span class="credit-amount">
//             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="black" stroke="currentColor" stroke-width="0" stroke-linecap="round" stroke-linejoin="round" class="icon icon--LBC icon__lbc icon__lbc--after-text" aria-hidden="true"></svg>
//             0.05
//          </span>
//       </span>
//    </div>
//    <div class="livestream-comment__body">
//       <div class="channel-thumbnail channel-thumbnail__default--2 channel-thumbnail--xsmall"><img class="channel-thumbnail__custom" loading="lazy" src="https://thumbnails.odycdn.com/optimize/s:160:160/quality:85/plain/https://spee.ch/spaceman-png:2.png" style="visibility: visible;"></div>
//       <div class="livestream-comment__info">
//          <div class="livestream-comment__meta-information"><button aria-expanded="false" aria-haspopup="true" aria-controls="menu--8" class="button--uri-indicator comment__author" data-reach-menu-button="" type="button" id="menu-button--menu--8">Chief-Kickabitch-of-the-Slapaho-Nation</button><span class="date_time" title="July 20, 2023 08:31 PM">2 minutes ago</span></div>
//          <div class="livestream-comment__text">
//             <div dir="auto" class="notranslate markdown-preview">
//                <p>Undisputed by Democrats that Trump go 75 million votes (he got more)  Total number of registered voters, 133 million.  133 - 75 = 58.  That assumes that 100% of all registered voters cast ballots which has never happened.  Only possible conclusion is that Trump won.</p>
//             </div>
//          </div>
//       </div>
//    </div>
//    <div class="livestream-comment__menu">
//       <button aria-expanded="false" aria-haspopup="true" aria-controls="menu--9" class="menu__button" data-reach-menu-button="" type="button" id="menu-button--menu--9">
//          <svg size="18" class="icon icon--MoreVertical" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>
//       </button>
//    </div>
// </li>

window.SNEED_OBSERVE_MUTATIONS = (mutation) => {
    const messages = [];
    
    mutation.addedNodes.forEach((node) => {
        const message = window.SNEED_GET_MESSAGE_DUMMY();
        message.platform = "Odysee";
        message.sent_at = Date.parse(node.querySelector(".date_time").getAttribute("title"));
        message.received_at = Date.now();

        message.avatar = node.querySelector(".channel-thumbnail__custom").getAttribute("src");
        message.username = node.querySelector(".comment__author").innerText;
        message.message = node.querySelector(".livestream-comment__text p").innerHTML;

        if (node.classList.contains("livestream__comment--hyperchat")) {
            message.is_premium = true;

            const amount = node.querySelector(".credit-amount").innerText;
            message.currency = amount.includes("$") ? "USD" : "$LBRY"; // Odysee hyperchats are either USD or $LBRY
            message.amount = parseFloat(amount.replace("$", ""));
        }

        if (node.querySelector(".icon--BadgeMod")) {
            message.is_mod = true;
        }
        if (node.querySelector(".icon--BadgeStreamer")) {
            message.is_owner = true;
        }

        messages.push(message);
    });

    return messages;
};