import 'dotenv/config';
import { PrismaClient, UnitType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database…');

  // ─── Units ────────────────────────────────────────────────────────────────
  const unitDefs = [
    { symbol: 'g', name: 'gram', type: UnitType.weight },
    { symbol: 'kg', name: 'kilogram', type: UnitType.weight },
    { symbol: 'oz', name: 'ounce', type: UnitType.weight },
    { symbol: 'lb', name: 'pound', type: UnitType.weight },
    { symbol: 'ml', name: 'millilitre', type: UnitType.volume },
    { symbol: 'l', name: 'litre', type: UnitType.volume },
    { symbol: 'cup', name: 'cup', type: UnitType.volume },
    { symbol: 'tbsp', name: 'tablespoon', type: UnitType.volume },
    { symbol: 'tsp', name: 'teaspoon', type: UnitType.volume },
    { symbol: 'cloves', name: 'cloves', type: UnitType.count },
    { symbol: 'clove', name: 'clove', type: UnitType.count },
    { symbol: 'pieces', name: 'pieces', type: UnitType.count },
    { symbol: 'piece', name: 'piece', type: UnitType.count },
    { symbol: 'slice', name: 'slice', type: UnitType.count },
    { symbol: 'bunch', name: 'bunch', type: UnitType.count },
    { symbol: 'whole', name: 'whole', type: UnitType.count },
    { symbol: 'bag', name: 'bag', type: UnitType.count },
    { symbol: 'dash', name: 'dash', type: UnitType.other },
    { symbol: 'lime', name: 'lime', type: UnitType.count },
    { symbol: 'bell pepper', name: 'bell pepper', type: UnitType.count },
    { symbol: 'pinch', name: 'pinch', type: UnitType.other },
    { symbol: 'unit', name: 'unit', type: UnitType.other },
  ];

  const units = await Promise.all(
    unitDefs.map((u) =>
      prisma.unit.upsert({
        where: { symbol: u.symbol },
        create: u,
        update: {},
      }),
    ),
  );
  const unitBySymbol = Object.fromEntries(units.map((u) => [u.symbol, u]));
  console.log(`  ✓ ${units.length} units`);

  // ─── Unit conversions ─────────────────────────────────────────────────────
  const conversionDefs = [
    { from: 'g', to: 'kg', factor: 0.001 },
    { from: 'kg', to: 'g', factor: 1000 },
    { from: 'oz', to: 'g', factor: 28.3495 },
    { from: 'g', to: 'oz', factor: 0.035274 },
    { from: 'lb', to: 'g', factor: 453.592 },
    { from: 'g', to: 'lb', factor: 0.002205 },
    { from: 'ml', to: 'l', factor: 0.001 },
    { from: 'l', to: 'ml', factor: 1000 },
    { from: 'tsp', to: 'ml', factor: 4.92892 },
    { from: 'tbsp', to: 'ml', factor: 14.7868 },
    { from: 'cup', to: 'ml', factor: 236.588 },
  ];

  await Promise.all(
    conversionDefs.map(({ from, to, factor }) =>
      prisma.unitConversion.upsert({
        where: {
          fromUnitId_toUnitId: {
            fromUnitId: unitBySymbol[from].id,
            toUnitId: unitBySymbol[to].id,
          },
        },
        create: {
          fromUnitId: unitBySymbol[from].id,
          toUnitId: unitBySymbol[to].id,
          factor,
        },
        update: { factor },
      }),
    ),
  );
  console.log(`  ✓ ${conversionDefs.length} unit conversions`);

  // ─── Ingredient categories ─────────────────────────────────────────────────
  const categoryDefs = [
    { slug: 'produce', name: 'Produce' },
    { slug: 'meat', name: 'Meat' },
    { slug: 'seafood', name: 'Seafood' },
    { slug: 'dairy', name: 'Dairy' },
    { slug: 'grains', name: 'Grains' },
    { slug: 'canned', name: 'Canned' },
    { slug: 'condiments', name: 'Condiments' },
    { slug: 'spices', name: 'Spices' },
    { slug: 'frozen', name: 'Frozen' },
    { slug: 'other', name: 'Other' },
  ];

  const categories = await Promise.all(
    categoryDefs.map((c) =>
      prisma.ingredientCategory.upsert({
        where: { slug: c.slug },
        create: c,
        update: {},
      }),
    ),
  );
  const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));
  console.log(`  ✓ ${categories.length} ingredient categories`);

  // ─── Tags ─────────────────────────────────────────────────────────────────
  const tagDefs = [
    { slug: 'pasta', name: 'Pasta' },
    { slug: 'rice', name: 'Rice' },
    { slug: 'bowl', name: 'Bowl' },
    { slug: 'stir_fry', name: 'Stir Fry' },
    { slug: 'salad', name: 'Salad' },
    { slug: 'soup', name: 'Soup' },
    { slug: 'sheet_pan', name: 'Sheet Pan' },
    { slug: 'quick', name: 'Quick' },
    { slug: 'healthy', name: 'Healthy' },
    { slug: 'cheap', name: 'Cheap' },
    { slug: 'high_protein', name: 'High Protein' },
    { slug: 'vegetarian', name: 'Vegetarian' },
    { slug: 'vegan', name: 'Vegan' },
    { slug: 'meal_prep', name: 'Meal Prep' },
  ];

  const tags = await Promise.all(
    tagDefs.map((t) =>
      prisma.tag.upsert({ where: { slug: t.slug }, create: t, update: {} }),
    ),
  );
  const tagBySlug = Object.fromEntries(tags.map((t) => [t.slug, t]));
  console.log(`  ✓ ${tags.length} tags`);

  // ─── Helper to upsert an ingredient ───────────────────────────────────────
  const ing = (name: string, catSlug: string) =>
    prisma.ingredient.upsert({
      where: { name },
      create: { name, categoryId: catBySlug[catSlug].id },
      update: {},
    });

  // ─── Ingredients ──────────────────────────────────────────────────────────
  const ingredients = await Promise.all([
    // Produce
    ing('onion', 'produce'),
    ing('garlic', 'produce'),
    ing('carrots', 'produce'),
    ing('celery', 'produce'),
    ing('parsley', 'produce'),
    ing('bell pepper', 'produce'),
    ing('broccoli', 'produce'),
    ing('spinach', 'produce'),
    ing('lemon', 'produce'),
    ing('lime', 'produce'),
    ing('ginger', 'produce'),
    ing('coriander', 'produce'),
    ing('basil leaves', 'produce'),
    ing('mixed salad', 'produce'),
    ing('potatoes', 'produce'),
    // Meat
    ing('chicken breast', 'meat'),
    ing('ground beef', 'meat'),
    // Dairy
    ing('parmesan', 'dairy'),
    ing('cheddar cheese', 'dairy'),
    ing('mozzarella', 'dairy'),
    ing('mascarpone', 'dairy'),
    ing('sour cream', 'dairy'),
    ing('butter', 'dairy'),
    ing('double cream', 'dairy'),
    ing('yogurt', 'dairy'),
    ing('halloumi', 'dairy'),
    // Grains
    ing('penne', 'grains'),
    ing('basmati rice', 'grains'),
    ing('brown rice', 'grains'),
    ing('rice', 'grains'),
    ing('tortillas', 'grains'),
    ing('gnocchi', 'grains'),
    ing('plain flour', 'grains'),
    // Canned
    ing('canned tomatoes', 'canned'),
    ing('canned chickpeas', 'canned'),
    ing('light coconut milk', 'canned'),
    ing('vegetable stock', 'canned'),
    // Condiments
    ing('olive oil', 'condiments'),
    ing('soy sauce', 'condiments'),
    ing('dijon mustard', 'condiments'),
    ing('worcestershire sauce', 'condiments'),
    ing('honey', 'condiments'),
    ing('sunflower oil', 'condiments'),
    ing('vegetable oil', 'condiments'),
    ing('rapeseed oil', 'condiments'),
    ing('tabasco', 'condiments'),
    ing('tikka masala curry paste', 'condiments'),
    ing('fresh salsa', 'condiments'),
    // Spices
    ing('cumin', 'spices'),
    ing('smoked paprika', 'spices'),
    ing('chilli flakes', 'spices'),
    ing('dried mixed herbs', 'spices'),
    ing('ground coriander', 'spices'),
    ing('thyme leaves', 'spices'),
    ing('turmeric', 'spices'),
    ing('garam masala', 'spices'),
    ing('nigella seeds', 'spices'),
    // Frozen
    ing('peas', 'frozen'),
    // Other
    ing('caster sugar', 'other'),
    ing('mash', 'other'),
  ]);
  const byName = Object.fromEntries(ingredients.map((i) => [i.name, i]));
  console.log(`  ✓ ${ingredients.length} ingredients`);

  // ─── Helper to create a recipe ────────────────────────────────────────────
  type IngRow = { name: string; amount: number; unitSymbol: string };
  async function upsertRecipe(
    id: string,
    data: {
      title: string;
      description: string;
      cookTimeMinutes: number;
      servings: number;
      tagSlugs: string[];
      steps: string[];
      ings: IngRow[];
      sourceUrl?: string;
    },
  ) {
    const existing = await prisma.recipe.findUnique({ where: { id } });
    if (existing) return existing;

    // Ensure all referenced ingredients exist
    const ingredientNames = [...new Set(data.ings.map((i) => i.name))];
    await Promise.all(
      ingredientNames.map((name) =>
        prisma.ingredient.upsert({
          where: { name },
          create: { name, categoryId: catBySlug['other'].id },
          update: {},
        }),
      ),
    );
    const ingRows = await prisma.ingredient.findMany({
      where: { name: { in: ingredientNames } },
    });
    const ingMap = Object.fromEntries(ingRows.map((i) => [i.name, i]));

    // Ensure all referenced units exist
    const unitSymbols = [...new Set(data.ings.map((i) => i.unitSymbol))];
    await Promise.all(
      unitSymbols.map((symbol) =>
        prisma.unit.upsert({
          where: { symbol },
          create: { symbol, name: symbol, type: UnitType.other },
          update: {},
        }),
      ),
    );
    const unitRows = await prisma.unit.findMany({
      where: { symbol: { in: unitSymbols } },
    });
    const unitMap = Object.fromEntries(unitRows.map((u) => [u.symbol, u]));

    const recipe = await prisma.recipe.create({
      data: {
        id,
        title: data.title,
        description: data.description,
        cookTimeMinutes: data.cookTimeMinutes,
        servings: data.servings,
        sourceUrl: data.sourceUrl ?? null,
        steps: data.steps.map((text, i) => ({ order: i + 1, text })),
        tags: {
          create: data.tagSlugs.map((slug) => ({ tagId: tagBySlug[slug].id })),
        },
        ingredients: {
          create: data.ings.map((i) => ({
            ingredientId: ingMap[i.name].id,
            unitId: unitMap[i.unitSymbol].id,
            amount: i.amount,
          })),
        },
      },
    });
    return recipe;
  }

  // ─── Seed recipes (BBC Good Food) ─────────────────────────────────────────
  const seeded = await Promise.all([
    upsertRecipe('cmp745qjn000k8rnxxntzgptm', {
      title: 'Chicken pasta bake',
      description:
        'Enjoy this gooey cheese and chicken pasta bake for the ultimate weekday family dinner. Serve straight from the dish with a dressed green salad',
      cookTimeMinutes: 45,
      servings: 6,
      sourceUrl: 'https://www.bbcgoodfood.com/recipes/chicken-pasta-bake',
      tagSlugs: ['high_protein', 'pasta', 'salad'],
      steps: [
        'Heat 2 tbsp of the oil in a pan over a medium heat and fry the onion gently for 10-12 mins. Add the garlic and chilli flakes and cook for 1 min. Tip in the tomatoes and sugar and season to taste. Simmer uncovered for 20 mins or until thickened, then stir through the mascarpone.',
        'Heat 1 tbsp of oil in a non-stick frying pan. Season the chicken and fry for 5-7 mins or until the chicken is cooked through.',
        'Heat the oven to 220C/200C fan/gas 7. Cook the penne following pack instructions. Drain and toss with the remaining oil. Tip the pasta into a medium sized ovenproof dish. Stir in the chicken and pour over the sauce. Top with the cheddar, mozzarella and parsley. Bake for 20 mins or until golden brown and bubbling.',
      ],
      ings: [
        { name: 'olive oil', amount: 4, unitSymbol: 'tbsp' },
        { name: 'onion', amount: 150, unitSymbol: 'g' },
        { name: 'garlic', amount: 2, unitSymbol: 'cloves' },
        { name: 'chilli flakes', amount: 0.25, unitSymbol: 'tsp' },
        { name: 'canned tomatoes', amount: 400, unitSymbol: 'g' },
        { name: 'caster sugar', amount: 1, unitSymbol: 'tsp' },
        { name: 'mascarpone', amount: 6, unitSymbol: 'tbsp' },
        { name: 'chicken breast', amount: 600, unitSymbol: 'g' },
        { name: 'penne', amount: 300, unitSymbol: 'g' },
        { name: 'cheddar cheese', amount: 70, unitSymbol: 'g' },
        { name: 'mozzarella', amount: 50, unitSymbol: 'g' },
        { name: 'parsley', amount: 1, unitSymbol: 'bunch' },
      ],
    }),
    upsertRecipe('cmp746gny001i8rnxxnze41gc', {
      title: 'Easy vegetarian chilli',
      description:
        "Rustle up our easy veggie chilli. It's a great recipe for batch-cooking – you can easily double it if you have a pan big enough, and freeze the rest",
      cookTimeMinutes: 55,
      servings: 8,
      sourceUrl: 'https://www.bbcgoodfood.com/recipes/easy-vegetarian-chilli',
      tagSlugs: ['quick', 'rice', 'vegetarian'],
      steps: [
        'Heat the oil in a large saucepan over a low-medium heat and fry the carrots, celery, onions and mixed herbs for 10-12 mins, stirring occasionally until the veg is soft but not golden. You may need to add a splash of water if the veg starts to catch.',
        'Stir in the garlic and both peppers, and cook for a further 5 mins until the peppers begin to soften. Sprinkle in the chilli powder and paprika, turn up the heat to medium, then stir and cook for 1 min. Mix in the tomato purée and cook for a further 1 min, then pour in all of the beans, the tomatoes and stock.',
        'Stir well, bring to the boil, then reduce the heat to a simmer. Cook for 25-35 mins until the beans are tender and the sauce has thickened. Serve with rice, grated cheddar and soured cream, if you like.',
      ],
      ings: [
        { name: 'olive oil', amount: 2, unitSymbol: 'tbsp' },
        { name: 'carrots', amount: 200, unitSymbol: 'g' },
        { name: 'celery', amount: 200, unitSymbol: 'g' },
        { name: 'onion', amount: 300, unitSymbol: 'g' },
        { name: 'dried mixed herbs', amount: 2, unitSymbol: 'tsp' },
        { name: 'garlic', amount: 2, unitSymbol: 'cloves' },
        { name: 'bell pepper', amount: 2, unitSymbol: 'bell pepper' },
        { name: 'chilli flakes', amount: 2, unitSymbol: 'tsp' },
        { name: 'smoked paprika', amount: 2, unitSymbol: 'tsp' },
        { name: 'canned tomatoes', amount: 800, unitSymbol: 'g' },
        { name: 'canned chickpeas', amount: 800, unitSymbol: 'g' },
        { name: 'vegetable stock', amount: 400, unitSymbol: 'ml' },
        { name: 'basmati rice', amount: 200, unitSymbol: 'g' },
        { name: 'cheddar cheese', amount: 100, unitSymbol: 'g' },
        { name: 'sour cream', amount: 240, unitSymbol: 'g' },
      ],
    }),
    upsertRecipe('cmp7473qa00278rnxtdx76mt5', {
      title: 'Chicken stroganoff',
      description:
        'Use chicken thigh fillets if you prefer in this chicken stroganoff, and use half-fat soured cream for a lighter version. Enjoy with pasta, mash or rice.',
      cookTimeMinutes: 30,
      servings: 4,
      sourceUrl: 'https://www.bbcgoodfood.com/recipes/chicken-stroganoff',
      tagSlugs: ['healthy', 'high_protein', 'pasta', 'rice'],
      steps: [
        'Heat half the oil in a frying pan and fry the chicken pieces over a medium high heat, stirring frequently. until golden brown. Season and transfer to a plate.',
        'Heat the remaining oil and lower the heat to medium. Fry the onion for 6-8 mins until softened but not golden, then stir in the garlic and paprika. Fry for a minute until fragrant, then pour in the stock, and add the Dijon and Worcestershire sauce. Tip in the seared chicken with any resting juices, and simmer for 5-6 mins until reduced slightly and the chicken is cooked through.',
        "Over a low heat, stir in the soured cream until just combined to create a creamy sauce, and it's just started to simmer. Scatter over the parsley and serve with rice, mash or pasta, if you like.",
      ],
      ings: [
        { name: 'olive oil', amount: 2, unitSymbol: 'tbsp' },
        { name: 'chicken breast', amount: 800, unitSymbol: 'g' },
        { name: 'onion', amount: 300, unitSymbol: 'g' },
        { name: 'garlic', amount: 4, unitSymbol: 'cloves' },
        { name: 'smoked paprika', amount: 1, unitSymbol: 'tbsp' },
        { name: 'vegetable stock', amount: 400, unitSymbol: 'ml' },
        { name: 'dijon mustard', amount: 4, unitSymbol: 'tsp' },
        { name: 'worcestershire sauce', amount: 2, unitSymbol: 'tbsp' },
        { name: 'sour cream', amount: 200, unitSymbol: 'g' },
        { name: 'parsley', amount: 1, unitSymbol: 'bunch' },
        { name: 'basmati rice', amount: 200, unitSymbol: 'g' },
      ],
    }),
    upsertRecipe('cmp747s9j003i8rnxv1w6vrxm', {
      title: 'Easy chicken fajitas',
      description:
        'Need a simple, vibrant midweek meal the family will love? Put together these easy chicken fajitas and people can create their own masterpieces at the table',
      cookTimeMinutes: 10,
      servings: 4,
      sourceUrl: 'https://www.bbcgoodfood.com/recipes/easy-chicken-fajitas',
      tagSlugs: ['high_protein', 'quick', 'salad'],
      steps: [
        'Heat oven to 200C/180C fan/gas 6 and wrap 8 medium tortillas in foil.',
        'Mix 1 heaped tbsp smoked paprika, 1 tbsp ground coriander, a pinch of ground cumin, 2 crushed garlic cloves, 4 tbsp olive oil, the juice of 1 lime and 4-5 drops Tabasco together in a bowl with a big pinch each of salt and pepper.',
        'Stir 2 chicken breasts, 1 red onion, 1 red pepper and 1 red chilli, if using, into the marinade.',
        'Heat a griddle pan until smoking hot and add the chicken and marinade to the pan.',
        'Keep everything moving over a high heat for about 5 mins using tongs until you get a nice charred effect. If your griddle pan is small you may need to do this in two batches.',
        'To check the chicken is cooked, find the thickest part and tear in half – if any part is still raw cook until done.',
        'Put the tortillas in the oven to heat up and serve with the cooked chicken, a bag of mixed salad and one 230g tub of fresh salsa.',
      ],
      ings: [
        { name: 'chicken breast', amount: 400, unitSymbol: 'g' },
        { name: 'onion', amount: 150, unitSymbol: 'g' },
        { name: 'bell pepper', amount: 1, unitSymbol: 'bell pepper' },
        { name: 'chilli flakes', amount: 1, unitSymbol: 'tsp' },
        { name: 'smoked paprika', amount: 1, unitSymbol: 'tbsp' },
        { name: 'ground coriander', amount: 1, unitSymbol: 'tbsp' },
        { name: 'cumin', amount: 1, unitSymbol: 'tsp' },
        { name: 'garlic', amount: 2, unitSymbol: 'cloves' },
        { name: 'olive oil', amount: 4, unitSymbol: 'tbsp' },
        { name: 'lime', amount: 1, unitSymbol: 'lime' },
        { name: 'tabasco', amount: 1, unitSymbol: 'dash' },
        { name: 'tortillas', amount: 8, unitSymbol: 'pieces' },
        { name: 'mixed salad', amount: 1, unitSymbol: 'bag' },
        { name: 'fresh salsa', amount: 230, unitSymbol: 'g' },
      ],
    }),
    upsertRecipe('cmp748cet004a8rnxzyn06j88', {
      title: 'Honey chicken',
      description:
        'Rustle up this family-friendly honey chicken, flavoured with garlic, soy sauce, lemon and ginger, in 30 minutes. Serve with rice and broccoli for a filling meal',
      cookTimeMinutes: 15,
      servings: 4,
      sourceUrl: 'https://www.bbcgoodfood.com/recipes/honey-chicken',
      tagSlugs: ['high_protein', 'quick', 'rice'],
      steps: [
        'Tip the chicken into a bowl, sprinkle over the flour and some seasoning and toss until the chicken is evenly coated.',
        'Combine the ginger, garlic, soy, honey and half the lemon juice in a bowl. Heat the oil in a large frying pan or wok over a high heat and fry the chicken for 3-4 mins until lightly golden. Tip in the honey sauce and stir-fry for 10 mins, or until the chicken is cooked through and the sauce has reduced enough to coat the back of a spoon. Taste for seasoning and squeeze over the remaining lemon juice, if needed, then serve with rice and steamed broccoli, if you like.',
      ],
      ings: [
        { name: 'chicken breast', amount: 4, unitSymbol: 'pieces' },
        { name: 'plain flour', amount: 2, unitSymbol: 'tbsp' },
        { name: 'ginger', amount: 40, unitSymbol: 'g' },
        { name: 'garlic', amount: 4, unitSymbol: 'cloves' },
        { name: 'soy sauce', amount: 6, unitSymbol: 'tbsp' },
        { name: 'honey', amount: 5, unitSymbol: 'tbsp' },
        { name: 'lemon', amount: 0.5, unitSymbol: 'whole' },
        { name: 'sunflower oil', amount: 1, unitSymbol: 'tbsp' },
        { name: 'basmati rice', amount: 1, unitSymbol: 'cup' },
        { name: 'broccoli', amount: 250, unitSymbol: 'g' },
      ],
    }),
    upsertRecipe('cmp748xis00518rnxc49krqdm', {
      title: 'Speedy lentil coconut curry',
      description:
        "This quick and easy curry has such great depth of flavour – it tastes like it's been cooked for hours. It's healthy too, as well as being low in fat and calories",
      cookTimeMinutes: 20,
      servings: 4,
      sourceUrl:
        'https://www.bbcgoodfood.com/recipes/speedy-lentil-coconut-curry',
      tagSlugs: ['healthy', 'quick', 'rice'],
      steps: [
        'Put the onion, garlic, chilli, carrot and ginger in a food processor and blitz to a smooth paste.',
        'Heat the oil in a medium saucepan over a medium heat and cook the veg paste for 4-5 mins until fragrant and starting to soften. Add the curry paste and cook for 1 min more, then add the lentils and stir to combine.',
        'Pour in the coconut milk and 50-75ml water, and bring to the boil. Reduce the heat to a simmer and cook for 10 mins until thickened and creamy. Add the peas in the final 5 mins, and season well.',
        'Stir in most of the coriander, then divide the curry between four bowls along with the rice. Sprinkle over the remaining coriander and top with the yogurt to serve.',
      ],
      ings: [
        { name: 'onion', amount: 150, unitSymbol: 'g' },
        { name: 'garlic', amount: 2, unitSymbol: 'cloves' },
        { name: 'chilli flakes', amount: 1, unitSymbol: 'tsp' },
        { name: 'carrots', amount: 100, unitSymbol: 'g' },
        { name: 'ginger', amount: 10, unitSymbol: 'g' },
        { name: 'vegetable oil', amount: 1, unitSymbol: 'tsp' },
        { name: 'tikka masala curry paste', amount: 100, unitSymbol: 'g' },
        { name: 'canned chickpeas', amount: 400, unitSymbol: 'g' },
        { name: 'light coconut milk', amount: 220, unitSymbol: 'ml' },
        { name: 'peas', amount: 200, unitSymbol: 'g' },
        { name: 'coriander', amount: 10, unitSymbol: 'g' },
        { name: 'brown rice', amount: 200, unitSymbol: 'g' },
        { name: 'yogurt', amount: 4, unitSymbol: 'tbsp' },
      ],
    }),
    upsertRecipe('cmp749fu9005o8rnxr6a4stt5', {
      title: 'Creamy spinach chicken',
      description:
        "Enjoy our creamy spinach chicken with plenty of sauce and rice or potatoes on the side. Serving four, it's an ideal midweek dinner for a family",
      cookTimeMinutes: 30,
      servings: 2,
      sourceUrl: 'https://www.bbcgoodfood.com/recipes/creamy-spinach-chicken',
      tagSlugs: ['high_protein', 'rice'],
      steps: [
        'Melt half the butter in a large frying pan over a medium heat and gently wilt the spinach, about 2-3 mins. Stir and season well. Remove to a colander to drain.',
        'If any liquid remains in the pan, pour it away and wipe it out. Melt the rest of the butter in the same pan over a medium heat, swirling it so the base of the pan is covered. Fry the chicken for 1-2 mins, stirring until lightly golden. Season well. Add the garlic and fry for 1 min more, then pour in the cream and simmer for 15 mins, stirring often until the chicken has cooked through – be careful not to let the cream boil.',
        'Stir in 30g of the cheese and all the spinach, squeezing out any excess liquid first. Simmer for another 5 mins until the cheese has melted and the chicken is cooked through. To check the chicken is ready, pierce the thickest part of the meat to ensure the juices run clear.',
        'Scatter with the remaining cheese and serve the chicken with plenty of the sauce, alongside rice or potatoes, if you like.',
      ],
      ings: [
        { name: 'butter', amount: 30, unitSymbol: 'g' },
        { name: 'spinach', amount: 240, unitSymbol: 'g' },
        { name: 'chicken breast', amount: 800, unitSymbol: 'g' },
        { name: 'garlic', amount: 4, unitSymbol: 'cloves' },
        { name: 'double cream', amount: 200, unitSymbol: 'ml' },
        { name: 'parmesan', amount: 40, unitSymbol: 'g' },
        { name: 'basmati rice', amount: 200, unitSymbol: 'g' },
      ],
    }),
    upsertRecipe('cmp749vk400638rnxav86622a', {
      title: 'Gnocchi & tomato bake',
      description: 'A comforting veggie main packed with rich Italian flavours',
      cookTimeMinutes: 25,
      servings: 4,
      sourceUrl: 'https://www.bbcgoodfood.com/recipes/gnocchi-tomato-bake',
      tagSlugs: ['pasta', 'vegetarian'],
      steps: [
        'Heat grill to high. Heat 1 tbsp olive oil in a large frying pan, then soften 1 onion and 1 red pepper for 5 mins.',
        'Stir in 1 garlic clove, fry for 1 min, tip in 400g chopped tomatoes and 500g gnocchi, then bring to a simmer.',
        'Bubble for 10-15 mins, stirring occasionally, until the gnocchi is soft and the sauce has thickened.',
        'Season, stir through a handful of basil leaves, then transfer to a large ovenproof dish.',
        'Scatter with torn chunks of mozzarella, then grill for 5-6 mins until the cheese is bubbling and golden.',
      ],
      ings: [
        { name: 'olive oil', amount: 1, unitSymbol: 'tbsp' },
        { name: 'onion', amount: 150, unitSymbol: 'g' },
        { name: 'bell pepper', amount: 1, unitSymbol: 'bell pepper' },
        { name: 'garlic', amount: 1, unitSymbol: 'clove' },
        { name: 'canned tomatoes', amount: 400, unitSymbol: 'g' },
        { name: 'gnocchi', amount: 500, unitSymbol: 'g' },
        { name: 'basil leaves', amount: 1, unitSymbol: 'bunch' },
        { name: 'mozzarella', amount: 125, unitSymbol: 'g' },
      ],
    }),
    upsertRecipe('cmp74aho2006m8rnxz4stlhf9', {
      title: 'One-pot goulash pasta',
      description:
        'Deliver big flavour with minimal effort with our healthy one-pot goulash made with wholemeal penne, steak mince and tomato, which delivers three of your 5-a-day',
      cookTimeMinutes: 45,
      servings: 4,
      sourceUrl: 'https://www.bbcgoodfood.com/recipes/one-pot-goulash-pasta',
      tagSlugs: ['healthy', 'pasta'],
      steps: [
        'Heat the oil in a large lidded pan over a medium heat and fry the onions for 10 mins, stirring frequently until golden. Add the mince, breaking apart any lumps with a wooden spoon. Stir in the peppers and cook for 5 mins.',
        'Add the garlic, thyme and paprika, and stir well. Tip in the tomatoes, tomato purée and stock, and bring to the boil. Reduce the heat and simmer, covered, for 10 mins. Tip in the penne, put the lid back on and bring back to the boil. Reduce the heat again and simmer for another 12 mins until the penne is tender. Leave to stand for 5 mins, then divide half the pasta between two plates and serve.',
      ],
      ings: [
        { name: 'rapeseed oil', amount: 2, unitSymbol: 'tbsp' },
        { name: 'onion', amount: 300, unitSymbol: 'g' },
        { name: 'ground beef', amount: 500, unitSymbol: 'g' },
        { name: 'bell pepper', amount: 2, unitSymbol: 'pieces' },
        { name: 'garlic', amount: 3, unitSymbol: 'cloves' },
        { name: 'thyme leaves', amount: 1, unitSymbol: 'tbsp' },
        { name: 'smoked paprika', amount: 2, unitSymbol: 'tbsp' },
        { name: 'canned tomatoes', amount: 400, unitSymbol: 'g' },
        { name: 'vegetable stock', amount: 800, unitSymbol: 'ml' },
        { name: 'penne', amount: 180, unitSymbol: 'g' },
      ],
    }),
    upsertRecipe('cmp74b4ow00758rnxa96ssay2', {
      title: 'Creamy halloumi & tomato curry',
      description:
        'Enjoy halloumi in this family-friendly curry – it has a wonderful texture, similar to paneer. You may want to halve the amount of garam masala for young children',
      cookTimeMinutes: 20,
      servings: 3,
      sourceUrl:
        'https://www.bbcgoodfood.com/recipes/creamy-halloumi-tomato-curry',
      tagSlugs: ['quick', 'rice', 'vegetarian'],
      steps: [
        'Cut the halloumi into bite-sized cubes and set them aside. Heat 1 tbsp of the oil in a large pan over a medium heat. Add the onion and cook for about 5 mins, or until it turns translucent.',
        'Add the garlic and ginger to the pan. Cook for another 2 mins, stirring frequently, until they become fragrant. Stir in the cumin, coriander and turmeric, and cook for 2 mins more. Pour in the tomatoes and stir well. Simmer for 5-7 mins, or until the mixture thickens.',
        'Reduce the heat and add the cream. Stir and simmer gently for 3-4 mins until thickened.',
        'While the sauce is simmering, heat the remaining 1 tbsp oil in a separate pan over a medium-high heat. Fry the halloumi for 3-4 mins until golden brown on all sides.',
        'Once the halloumi is browned, add it to the sauce along with the spinach, sugar and garam masala and stir to combine. Gently simmer for 5 mins until the spinach has wilted or defrosted. If the curry seems too thick, add a splash of water or more cream to loosen it. Scatter with nigella seeds and serve with rice or naan.',
      ],
      ings: [
        { name: 'halloumi', amount: 225, unitSymbol: 'g' },
        { name: 'vegetable oil', amount: 2, unitSymbol: 'tbsp' },
        { name: 'onion', amount: 150, unitSymbol: 'g' },
        { name: 'garlic', amount: 2, unitSymbol: 'cloves' },
        { name: 'ginger', amount: 1, unitSymbol: 'piece' },
        { name: 'cumin', amount: 2, unitSymbol: 'tsp' },
        { name: 'ground coriander', amount: 2, unitSymbol: 'tsp' },
        { name: 'turmeric', amount: 1, unitSymbol: 'tsp' },
        { name: 'canned tomatoes', amount: 400, unitSymbol: 'g' },
        { name: 'double cream', amount: 100, unitSymbol: 'ml' },
        { name: 'spinach', amount: 80, unitSymbol: 'g' },
        { name: 'caster sugar', amount: 2, unitSymbol: 'tsp' },
        { name: 'garam masala', amount: 1, unitSymbol: 'tbsp' },
        { name: 'nigella seeds', amount: 1, unitSymbol: 'tsp' },
        { name: 'rice', amount: 200, unitSymbol: 'g' },
      ],
    }),
  ]);

  console.log(
    `  ✓ ${seeded.length} seed recipes: ${seeded.map((r) => r.title).join(', ')}`,
  );
  console.log('✅ Done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
