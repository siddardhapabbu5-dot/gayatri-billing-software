const IMG = "/site/images";

const PERKS = [
  {
    title: "Premium Rooms",
    num: "4",
    text: "Spacious and comfortable rooms with beautiful views, giving every family member a peaceful place to unwind.",
  },
  {
    title: "Private Kitchen Facility",
    text: "Prepare your favourite meals, enjoy homemade flavours and create those little family moments around the kitchen.",
  },
  {
    title: "Elegant Dining Hall",
    text: "Bring everyone together around one table. Share meals, conversations, laughter and memories in your own comfortable dining space.",
  },
  {
    title: "Spacious Lobby",
    text: "A welcoming common area where the family can gather, relax, talk, play games or simply spend quality time together.",
  },
];

function Hero({ onBook, loadMedia = true }) {
  return (
    <div className="retreat-hero">
      <div className="retreat-photos">
        {loadMedia ? (
          <>
            <img src={`${IMG}/retreat-family-lobby.jpg`} alt="Family enjoying the lobby together" loading="lazy" decoding="async" />
            <img src={`${IMG}/retreat-family-dining.jpg`} alt="Family sharing a meal in the dining hall" loading="lazy" decoding="async" />
          </>
        ) : (
          <>
            <div className="retreat-photo-slot" aria-hidden="true" />
            <div className="retreat-photo-slot" aria-hidden="true" />
          </>
        )}
      </div>
      <div className="retreat-hero-copy">
        <p className="retreat-kicker">Exclusive family stay</p>
        <h2>The Royal Family Retreat</h2>
        <p className="retreat-tag">One Stay. One Family. A Thousand Beautiful Memories.</p>
        <p className="retreat-price">
          ₹30,000 <span>/ package</span>
        </p>
        <p className="retreat-bundle">4 Rooms + Kitchen + Dining Hall + Lobby</p>
        {onBook ? (
          <button type="button" className="btn retreat-book" onClick={onBook}>
            Book this stay
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Space() {
  return (
    <div className="retreat-board retreat-space">
      <div className="retreat-board-intro">
        <p className="retreat-kicker dark">More than a hotel stay</p>
        <h3>Just your family, your space and your time together.</h3>
        <p>
          Imagine waking up together, enjoying a cup of tea with a beautiful view, preparing breakfast as a family,
          gathering around the dining table for lunch, spending the evening together in the lobby and ending the day
          with stories and laughter.
        </p>
        <ul className="retreat-points">
          <li>No rushing between separate rooms.</li>
          <li>No searching for restaurants for every meal.</li>
          <li>No feeling like strangers in a hotel.</li>
        </ul>
      </div>
      <div className="retreat-perks">
        {PERKS.map((item) => (
          <div key={item.title} className="retreat-perk">
            <h4>
              {item.num ? <span className="retreat-perk-num">{item.num}</span> : null}
              {item.num ? " " : null}
              {item.title}
            </h4>
            <p>{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Close({ onBook }) {
  return (
    <div className="retreat-board retreat-close-board">
      <div className="retreat-board-main">
        <div>
          <p className="retreat-kicker dark">More than a hotel stay</p>
          <h3>Just your family, your space and your time together.</h3>
          <p>
            Imagine waking up together, enjoying a cup of tea with a beautiful view, preparing breakfast as a family,
            gathering around the dining table for lunch, spending the evening together in the lobby and ending the day
            with stories and laughter.
          </p>
          <ul className="retreat-points">
            <li>No rushing between separate rooms.</li>
            <li>No searching for restaurants for every meal.</li>
            <li>No feeling like strangers in a hotel.</li>
          </ul>
        </div>
        <div className="retreat-board-cards">
          <div className="retreat-complete">
            <h3>A Complete Family Experience — ₹30,000</h3>
            <p className="retreat-complete-line">4 Rooms + Kitchen + Dining Hall + Lobby</p>
            <p>
              Everything you need for a comfortable family getaway, thoughtfully brought together in one exclusive
              package.
            </p>
          </div>
          <blockquote>
            Because luxury isn&apos;t always about extravagance.
            <br />
            Sometimes, luxury is simply having everyone you love under one roof.
          </blockquote>
        </div>
      </div>
      <div className="retreat-board-foot">
        <div>
          <p className="retreat-close">Come together. Stay together. Celebrate together.</p>
          <p className="retreat-signoff">
            <strong>The Royal Family Retreat</strong>
            <em>₹30,000 / Package</em>
          </p>
          <p className="retreat-fine">Limited availability. Terms &amp; conditions apply.</p>
        </div>
        {onBook ? (
          <button type="button" className="btn retreat-book" onClick={onBook}>
            Book this stay
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function RetreatOffer({ onBook, part = "all", loadMedia = true }) {
  return (
    <article className={`retreat retreat-${part}`}>
      {(part === "all" || part === "hero") && <Hero onBook={onBook} loadMedia={loadMedia} />}
      {(part === "all" || part === "space") && <Space />}
      {(part === "all" || part === "close") && <Close onBook={part === "all" ? undefined : onBook} />}
    </article>
  );
}
