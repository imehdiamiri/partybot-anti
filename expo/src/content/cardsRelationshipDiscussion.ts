import type { PartyCard } from '../models/CardModels';

// 112 authored situations, six distinct discussion lenses each. Append-only IDs.
// All characters are adults. Scenarios invite debate, not advice or stereotypes.
export const RELATIONSHIP_SITUATIONS = `
One partner wants daily messages; the other prefers space between conversations.
A woman earns more than her boyfriend, and he avoids discussing money.
A man wants to be a stay-at-home parent; his girlfriend fears others will judge them.
Two friends disagree about whether the man should pay on a first date.
A couple splits bills equally despite very different incomes.
Someone buys expensive gifts instead of apologizing after arguments.
A partner calls constant location sharing a sign of love.
Someone reads their partner's private messages while the partner is asleep.
A boyfriend likes an ex's photos but hides the contact from his girlfriend.
A girlfriend stays close to an ex who is also her business partner.
Someone wants their partner to stop having close friends of another gender.
A friend repeatedly flirts with someone who is already in a relationship.
A couple disagrees about whether flirting online counts as betrayal.
Someone keeps a dating profile active after agreeing to be exclusive.
Two people have been dating for months but never discussed exclusivity.
Someone wants a relationship label; the other person says labels ruin things.
A person asks for commitment but refuses to discuss a shared future.
Someone introduces a partner as just a friend without warning them.
A couple posts happy photos while hiding serious problems from each other.
One partner wants to post couple photos; the other values online privacy.
Someone announces a breakup online before telling their partner privately.
A partner shares screenshots of arguments with a group chat.
Someone discusses intimate relationship details with a friend without asking first.
A couple disagrees about using an AI chatbot to settle their arguments.
A partner secretly records an argument to prove what was said.
Someone asks a friend to test whether their partner would cheat.
A couple disagrees about attending a wedding where an ex will be present.
Someone invites an ex to a birthday party without telling their current partner.
A partner compares every disagreement to what their ex used to do.
Someone keeps letters from an old relationship in a private box.
A person expects their partner to reveal every detail of past relationships.
Two people disagree about whether past dating experience should affect trust.
A woman is criticized for dating casually while a man is praised for the same behavior.
A man cries during an argument and his girlfriend calls him weak.
A woman sets a firm boundary and is called difficult by her boyfriend's friends.
Someone says jealousy proves love even when it limits a partner's freedom.
A partner mistakes politeness toward a stranger for romantic interest.
Someone expects a partner to change clothing to prevent unwanted attention.
A boyfriend wants equal decision-making but expects his girlfriend to do the planning.
A girlfriend expects traditional courtship but equal control over every shared decision.
A couple wants equality but has never defined what equal effort means.
One partner notices every household task; the other waits to be asked.
Someone treats childcare as helping their partner rather than shared responsibility.
A couple shares chores equally but only one person remembers family birthdays.
One partner works longer hours and expects to do no housework.
A person quietly does extra chores and resents a partner who never notices.
A couple argues over whose career should take priority after a move.
Someone receives a dream job offer in another country while their partner wants to stay.
A partner gives up a promotion and later uses the sacrifice to win arguments.
Two people love each other but disagree about having children.
A couple disagrees about whether marriage is necessary for commitment.
Someone wants an expensive wedding while their partner wants financial security.
A family expects a couple to follow wedding traditions neither partner enjoys.
Parents dislike a partner because of their income rather than their behavior.
A couple from different religions disagrees about future family traditions.
Someone changes how they speak around their partner's family to avoid criticism.
A partner's parent criticizes the relationship and the partner stays silent.
A couple disagrees about how much financial help to give relatives.
Someone lends shared savings to a sibling without asking their partner.
A person hides debt because they fear being rejected by a new partner.
A couple disagrees about keeping separate bank accounts after marriage.
One partner tracks every shared expense while the other finds that unromantic.
A wealthy partner pays for everything and expects to make all the decisions.
Someone feels unable to leave a relationship because their partner pays the rent.
A partner asks for a prenuptial agreement and the other hears a lack of trust.
Someone calls their partner materialistic for wanting financial stability.
A couple disagrees about whether emotional support can balance unequal financial support.
A partner becomes distant after losing a job and refuses offers of help.
Someone is always available for friends but too tired for their partner.
A couple disagrees about spending holidays together versus with separate families.
One partner needs quiet after work; the other needs to talk immediately.
Someone gives the silent treatment instead of asking for a break from an argument.
A partner wants to solve every disagreement before sleeping; the other needs time.
Someone jokes about a partner's insecurity and says they are too sensitive.
A couple disagrees about whether teasing in public is affectionate or disrespectful.
One person apologizes quickly but repeatedly returns to the same hurtful behavior.
A partner accepts an apology but brings up the incident in every new argument.
Someone says they forgive a mistake but demands permanent access to private accounts.
A couple disagrees about whether trust can return after a hidden conversation.
A person ends a relationship by disappearing instead of having a difficult conversation.
Someone wants friendship immediately after a breakup; their ex needs distance.
A person starts dating a close friend's former partner without discussing it first.
Friends pressure someone to leave a relationship without hearing their perspective.
A friend stays neutral after witnessing disrespect in someone else's relationship.
Someone tells a friend their partner is cheating but has only heard a rumor.
A couple disagrees about whether friends should know about every argument.
A person keeps defending a friend who repeatedly cancels plans at the last minute.
Someone only contacts an old friend when they need a favor.
A friendship becomes awkward when one friend becomes much more successful.
Two friends have different budgets and always choose activities the richer one likes.
Someone shares a friend's secret because they believe it will help them.
A friend expects instant replies but takes days to answer other people's messages.
An adult child sets boundaries with a parent and is accused of being ungrateful.
Siblings disagree about who should care for an aging parent.
A family calls a person's decision to live alone selfish.
Someone feels responsible for keeping peace between relatives who keep arguing.
A group repeatedly invites one person only when someone else cancels.
A friend changes their opinions to fit in and gradually feels invisible.
Someone wants honest feedback but becomes defensive whenever a friend gives it.
Two people disagree strongly about politics but want to remain close.
A couple disagrees about whether different views on gender roles are a deal-breaker.
Someone says all men or all women behave badly after one painful breakup.
A person expects a partner to understand needs they have never expressed.
A couple has different ideas about how often affection should be shown.
Someone enjoys time alone but their partner interprets it as rejection.
A partner supports personal growth until it changes their shared routines.
Two people feel deep affection but no longer enjoy the same kind of life.
A couple considers taking a break but cannot agree on what the break permits.
Someone stays in a relationship mainly because their families get along.
A partner wants couples counseling; the other feels it means they have failed.
Someone thinks being right in an argument matters more than feeling understood.
A couple realizes their idea of romance came mostly from films and social media.
`.trim().split('\n');

export const DISCUSSION_LENSES = [
  'What would a fair agreement look like?',
  'Which boundary needs to be discussed first?',
  'How might each person describe the same situation differently?',
  'What could someone say to open a useful conversation?',
  'What missing detail could change your opinion?',
  'What small action would show real progress a month later?',
];

export const RELATIONSHIP_DISCUSSION_CARDS: PartyCard[] = RELATIONSHIP_SITUATIONS.flatMap((situation, index) =>
  DISCUSSION_LENSES.map((question, lens) => ({
    id: `relationships-20260907-${index + 1}-${lens + 1}`,
    category: 'talk' as PartyCard['category'],
    subtype: 'discussion' as PartyCard['subtype'],
    text: `${situation} ${question}`,
    isSpicy: false,
  }))
);
