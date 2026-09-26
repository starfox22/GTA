    // BEGIN SUBSYSTEM: src/dealership.js — MONARCH MOTORS: the plan, the sale, the garage and the alarm
    /**
     * MONARCH MOTORS · PRESTIGE COLLECTION
     * Source: src/dealership.js
     * Scope: shared game closure (after monarch-life.js; monarch.js calls
     * planDealership from planIsleBlock for block (0, 2), 'motors').
     *
     * The island's flagship car dealership fills the whole block on Crown Avenue
     * at the Sovereign Bridge's landing, facing Regent Row:
     *
     *   THE HALL      74 x 47 m, 11 m high: a glass frontage of 3 m panes onto the
     *                 forecourt, stone side and back walls. Inside: the display
     *                 floor (twelve cars on flush turntables and plinths, the
     *                 Tourbillon on the hero dais), the backlit brand walls of
     *                 WALTER MARTIN, CHEVETTE and MUGATTI along the back wall,
     *                 the DELIVERY SUITE in the west wing (a stage turntable
     *                 behind a curtain, the service desk and the vehicle door
     *                 onto the forecourt), the VIP LOUNGE in the north-east
     *                 (sofas, a bar under the gallery), the CONFIGURATOR WALL and
     *                 the reception desk by the entrance.
     *   FORECOURT     three cars on podiums, the entrance walk between planters
     *                 and flags, the handover bay outside the vehicle door, eight
     *                 OWNERS' BAYS along the west lane where cars you own wait,
     *                 the lit pylon on Regent Row.
     *
     * dealership3d.js draws it all from DEALER; dealership-people.js staffs it
     * (receptionist, salesmen, barista, guards) and fills it with enthusiasts.
     *
     * BUYING. Walk up to a car on display: the prompt names it and its price;
     * the action key opens the purchase card (gameMode 'dealer'): the spec
     * sheet, the blurb, paint swatches (the car on the plinth is resprayed as
     * you choose), BUY when you can afford it or INSUFFICIENT FUNDS with the
     * shortfall, a TEST DRIVE, and the other cars with the up / down keys.
     * Buying takes the cash and saves, then the DELIVERY: you are shown to the
     * suite, the car stands on the stage behind the curtain, the curtain draws
     * back and the stage turns under confetti while the salesman congratulates
     * you; the keys are handed over at the handover bay outside, where the car
     * waits. Owned cars are saved (localStorage `dead-end-city-garage`), never
     * count as stolen, and are kept in the OWNERS' BAYS: one missing (wrecked,
     * or left somewhere) is brought back to its bay while you are away, and the
     * concierge's MY GARAGE menu (at the reception desk) brings any of them to
     * the handover bay.
     *
     * SECURITY. Attacking the dealership (gunfire or an explosion on the lot,
     * hurting staff, guards or visitors, shooting or ramming the glass,
     * damaging a display car, driving off in one) sounds the alarm: shutters
     * roll down the frontage, the guards draw and fight (story.js
     * updateGangFights: they are gang members of the 'prestige' faction), and
     * the wanted level goes straight to four stars, rising to five by the usual
     * rules (heat.js). The glass panes shatter one by one (their collider goes
     * with them). Display cars can be taken by force once the alarm is up.
     *
     * Free roam (not a mission): available in any build, the demo included.
     */
    // @include src/dealership-lot.js
    // @include src/dealership-menu.js
    // END SUBSYSTEM: src/dealership.js
