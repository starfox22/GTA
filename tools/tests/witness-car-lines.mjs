// A 911 caller's description of the player's vehicle uses the right article: "an orange sedan",
// "an SUV", "an ambulance", but "a black SUV" and "a white car" (it said "A orange car, going northeast!").
export default async function (t) {
  const cases = [
    // [type, colour, the phrase after the article]
    ['sedan', '#e8742a', 'orange sedan', 'an'],
    ['sedan', '#101010', 'black sedan', 'a'],
    ['suv', '#101010', 'black SUV', 'a'],
    ['suv', 'none', 'SUV', 'an'],
    ['ambulance', 'none', 'ambulance', 'an'],
    ['van', '#f0f0f0', 'white van', 'a'],
    ['sedan', 'none', 'sedan', 'a'],
  ];
  for (const [type, color, what, article] of cases) {
    const lines = await t.call('witnessCarLines', type, color, 'northeast');
    t.assert(lines.length === 3, `${type} ${color}: ${JSON.stringify(lines)}`);
    const Article = article[0].toUpperCase() + article.slice(1);
    t.assert(lines[0] === `He’s in ${article} ${what}!`, `line 0 for ${what}: ${lines[0]}`);
    t.assert(lines[1] === `He took off in ${article} ${what}, heading northeast!`, `line 1 for ${what}: ${lines[1]}`);
    t.assert(lines[2] === `${Article} ${what}, going northeast!`, `line 2 for ${what}: ${lines[2]}`);
  }
}
