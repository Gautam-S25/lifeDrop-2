/* data.js — all sample content in one place so it is easy to customise */
(function (w) {
  'use strict';

  const DAY = 864e5;
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  /* Camp dates are generated relative to "today" so the demo never goes stale */
  const inDays = (n) => new Date(base.getTime() + n * DAY);

  const groups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

  const donateTo = {
    'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    'O+': ['O+', 'A+', 'B+', 'AB+'],
    'A-': ['A-', 'A+', 'AB-', 'AB+'],
    'A+': ['A+', 'AB+'],
    'B-': ['B-', 'B+', 'AB-', 'AB+'],
    'B+': ['B+', 'AB+'],
    'AB-': ['AB-', 'AB+'],
    'AB+': ['AB+']
  };
  const receiveFrom = {};
  groups.forEach((r) => { receiveFrom[r] = groups.filter((d) => donateTo[d].includes(r)); });

  const camps = [
    { id: 'c1', name: 'City Heart Mega Drive',     city: 'Bengaluru', venue: 'Town Hall, Jayanagar',        date: inDays(3),  start: '09:00', end: '17:00', seats: 120, booked: 78, needs: ['O-', 'A-', 'B-'] },
    { id: 'c2', name: 'Campus Lifeline Camp',      city: 'Chennai',   venue: 'Anna University Auditorium',  date: inDays(5),  start: '09:00', end: '15:00', seats: 90,  booked: 41, needs: ['B+', 'AB-'] },
    { id: 'c3', name: 'Sunrise Community Camp',    city: 'Pune',      venue: 'Shivaji Nagar Community Hall', date: inDays(8),  start: '08:00', end: '14:00', seats: 80,  booked: 66, needs: ['O+', 'A+'] },
    { id: 'c4', name: 'Metro Mega Blood Drive',    city: 'Mumbai',    venue: 'Andheri Sports Complex',      date: inDays(11), start: '10:00', end: '18:00', seats: 150, booked: 52, needs: ['O-', 'AB-', 'B-'] },
    { id: 'c5', name: 'Tech Park Donate-a-thon',   city: 'Hyderabad', venue: 'HITEC City Convention Hall',  date: inDays(14), start: '09:00', end: '16:00', seats: 100, booked: 34, needs: ['A-', 'O-'] },
    { id: 'c6', name: 'Capital Care Camp',         city: 'Delhi',     venue: 'Dwarka Cultural Centre',      date: inDays(18), start: '09:00', end: '17:00', seats: 130, booked: 97, needs: ['B+', 'O+', 'AB+'] },
    { id: 'c7', name: 'Garden City Giving Day',    city: 'Bengaluru', venue: 'Lalbagh Glass House Lawn',    date: inDays(22), start: '08:30', end: '13:30', seats: 70,  booked: 12, needs: ['O-', 'A+'] },
    { id: 'c8', name: 'Marina Hope Camp',          city: 'Chennai',   venue: 'Besant Nagar Community Hall', date: inDays(27), start: '09:00', end: '15:00', seats: 85,  booked: 23, needs: ['B-', 'AB+'] },
    { id: 'c9', name: 'Pink City Donor Meet',      city: 'Jaipur',    venue: 'Rajasthan Red Cross Hall',    date: inDays(31), start: '09:00', end: '16:00', seats: 95,  booked: 18, needs: ['A-', 'B+'] }
  ];

  /* Stock levels (units) — capacity is 100 for the demo bars */
  const stock = [
    { g: 'A+', u: 72 }, { g: 'A-', u: 18 }, { g: 'B+', u: 64 }, { g: 'B-', u: 12 },
    { g: 'O+', u: 80 }, { g: 'O-', u: 9 },  { g: 'AB+', u: 35 }, { g: 'AB-', u: 6 }
  ];

  const weekly = [38, 52, 47, 66, 59, 84, 71];
  const weekLabels = weekly.map((_, i) => {
    const d = new Date(base.getTime() - (weekly.length - 1 - i) * DAY);
    return d.toLocaleDateString('en-IN', { weekday: 'short' });
  });

  const quiz = [
    { q: 'Are you between 18 and 65 years old?', hint: 'Most blood banks accept donors in this range.', ok: true, fail: 'Donors are generally required to be 18–65 years old.' },
    { q: 'Do you weigh 50 kg (110 lb) or more?', hint: 'A minimum weight keeps donation safe for you.', ok: true, fail: 'A minimum body weight of about 50 kg is usually required.' },
    { q: 'Do you feel healthy and well today?', hint: 'No fever, cold, cough, sore throat or infection.', ok: true, fail: 'Please wait until you are fully recovered from any illness.' },
    { q: 'Have you donated whole blood in the last 3 months?', hint: 'Women are often asked to wait 4 months.', ok: false, fail: 'Whole blood donations need a gap of about 3–4 months.' },
    { q: 'Have you had a tattoo, piercing or acupuncture in the last 6 months?', hint: 'Waiting periods can vary by location.', ok: false, fail: 'A waiting period of around 6 months usually applies after tattoos or piercings.' },
    { q: 'Are you currently pregnant or breastfeeding?', hint: 'Or have you given birth in the last 6 months?', ok: false, fail: 'Please wait until after pregnancy and breastfeeding before donating.' },
    { q: 'Are you taking antibiotics, or had major surgery in the last 6–12 months?', hint: 'Or are you being treated for a chronic condition?', ok: false, fail: 'Recent surgery or ongoing antibiotic treatment usually means you should wait.' }
  ];

  const myths = [
    { m: 'Donating blood hurts a lot.',            f: 'You feel a quick pinch. The donation itself takes only 8–10 minutes.' },
    { m: 'I will feel weak for days afterwards.',   f: 'Most donors feel fine after a rest, a snack and plenty of fluids. Your body soon replaces the fluid.' },
    { m: 'Vegetarians cannot donate blood.',        f: 'Diet is not the deciding factor. If you meet the health and haemoglobin criteria, you can donate.' },
    { m: 'You can catch an infection by donating.', f: 'Every donor gets a brand-new, sterile, single-use needle and collection kit.' },
    { m: 'Tattoos mean you can never donate.',      f: 'You usually just wait a few months after a new tattoo, then you are welcome again.' },
    { m: 'Donating lowers your immunity.',          f: 'Your body replenishes the donated blood cells, and a healthy donor’s immunity is not weakened.' }
  ];

  const faqs = [
    { q: 'How long does the whole visit take?', a: 'Plan for 45–60 minutes in total: registration, a short health screening, the donation (about 10 minutes) and a short rest with refreshments.' },
    { q: 'How often can I donate blood?', a: 'Typically every 3 months for men and every 4 months for women for whole blood. Local rules can differ, so the camp’s medical officer will confirm.' },
    { q: 'What should I eat and drink before donating?', a: 'Have a healthy, iron-rich meal and drink plenty of water. Avoid fatty food just before donating, and skip alcohol for 24 hours.' },
    { q: 'Who should not donate?', a: 'People who are unwell, underweight, pregnant, recently had surgery, tattoos or piercings, or are on certain medicines should wait or consult the doctor. Use the eligibility checker above for a quick guide.' },
    { q: 'What happens to my blood after I donate?', a: 'It is tested for safety, separated into components such as red cells, plasma and platelets, and stored until a hospital needs it — so one donation can help several patients.' },
    { q: 'Is my personal data safe on this site?', a: 'In this demo everything stays in your own browser (localStorage). Nothing is sent to a server. A production site would add a secure backend.' }
  ];

  const stories = [
    { t: 'I was nervous before my first donation, but the volunteers were so kind. Ten minutes later I was sipping juice and feeling like a hero.', n: 'Aarav S.', r: 'First-time donor' },
    { t: 'My father needed O-negative blood during surgery. Strangers donating at a camp like this gave our family more time together. Now I donate every 3 months.', n: 'Meera K.', r: 'Regular donor, 14 donations' },
    { t: 'Booking a slot online meant no waiting around. I got my donor card, took a selfie and challenged my whole office to join.', n: 'Rohan D.', r: 'Corporate camp organizer' },
    { t: 'As a nurse I see how much blood matters every single day. Donating is the easiest way to help a patient you will never meet.', n: 'Fatima Z.', r: 'Nurse & volunteer' }
  ];

  w.LD = Object.assign(w.LD || {}, {
    data: { groups, donateTo, receiveFrom, camps, stock, weekly, weekLabels, quiz, myths, faqs, stories }
  });
})(window);
