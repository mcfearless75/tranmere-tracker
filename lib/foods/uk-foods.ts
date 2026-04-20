/**
 * Curated UK food database — macros per serving, aligned to CoFID (Public
 * Health England's Composition of Foods Integrated Dataset) where possible.
 *
 * Each food has:
 *   name, category, serving (g or unit), calories, protein_g, carbs_g, fat_g, tags
 *
 * Covers:
 *  - Generic staples (CoFID)
 *  - British meals
 *  - Athlete favourites (pre/post training)
 *  - Takeaway classics
 *  - School dinner classics
 *  - Common supermarket ready meals
 */

export type UkFood = {
  name: string
  category: string
  serving: string           // human-readable serving e.g. "100g", "1 slice", "1 medium"
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  tags?: string[]
  quick?: boolean           // surface on quick-picks grid
}

export const UK_FOODS: UkFood[] = [
  // === ATHLETE STAPLES (quick picks) ===
  { name: 'Chicken breast, grilled', category: 'Protein', serving: '150g', calories: 248, protein_g: 46.5, carbs_g: 0, fat_g: 6.4, quick: true, tags: ['meat', 'protein'] },
  { name: 'Brown rice, cooked', category: 'Grain', serving: '200g', calories: 222, protein_g: 5.0, carbs_g: 46.0, fat_g: 1.8, quick: true },
  { name: 'White rice, cooked', category: 'Grain', serving: '200g', calories: 260, protein_g: 5.4, carbs_g: 56.4, fat_g: 0.6, quick: true },
  { name: 'Wholemeal pasta, cooked', category: 'Grain', serving: '200g', calories: 248, protein_g: 10.0, carbs_g: 48.2, fat_g: 2.0, quick: true },
  { name: 'White pasta, cooked', category: 'Grain', serving: '200g', calories: 262, protein_g: 9.0, carbs_g: 51.2, fat_g: 1.6, quick: true },
  { name: 'Porridge oats with milk', category: 'Breakfast', serving: '250g', calories: 185, protein_g: 8.0, carbs_g: 30.0, fat_g: 3.5, quick: true },
  { name: 'Protein shake (whey)', category: 'Drink', serving: '30g scoop + water', calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1.5, quick: true },
  { name: 'Banana', category: 'Fruit', serving: '1 medium (118g)', calories: 105, protein_g: 1.3, carbs_g: 27.0, fat_g: 0.4, quick: true },
  { name: 'Apple', category: 'Fruit', serving: '1 medium (180g)', calories: 95, protein_g: 0.5, carbs_g: 25.0, fat_g: 0.3, quick: true },
  { name: 'Eggs, scrambled (2)', category: 'Breakfast', serving: '2 eggs', calories: 200, protein_g: 14.0, carbs_g: 2.0, fat_g: 15.0, quick: true },
  { name: 'Greek yoghurt (0%)', category: 'Dairy', serving: '170g pot', calories: 100, protein_g: 17.0, carbs_g: 6.0, fat_g: 0.4, quick: true },
  { name: 'Peanut butter on toast', category: 'Breakfast', serving: '2 slices + 30g', calories: 380, protein_g: 12.0, carbs_g: 32.0, fat_g: 22.0, quick: true },
  { name: 'Wholemeal bread', category: 'Bread', serving: '1 slice (40g)', calories: 92, protein_g: 3.6, carbs_g: 16.8, fat_g: 1.0, quick: true },
  { name: 'White bread', category: 'Bread', serving: '1 slice (40g)', calories: 93, protein_g: 3.2, carbs_g: 17.4, fat_g: 0.7, quick: true },
  { name: 'Semi-skimmed milk', category: 'Dairy', serving: '250ml glass', calories: 120, protein_g: 8.4, carbs_g: 11.8, fat_g: 4.3, quick: true },

  // === BREAKFAST ===
  { name: 'Weetabix with milk (2)', category: 'Breakfast', serving: '2 biscuits + 125ml', calories: 200, protein_g: 8.5, carbs_g: 36.0, fat_g: 3.0 },
  { name: 'Granola with milk', category: 'Breakfast', serving: '60g + 150ml', calories: 340, protein_g: 9.5, carbs_g: 50.0, fat_g: 10.0 },
  { name: 'Full English breakfast', category: 'Breakfast', serving: '1 plate', calories: 810, protein_g: 40.0, carbs_g: 50.0, fat_g: 50.0 },
  { name: 'Bacon sandwich', category: 'Breakfast', serving: '1 sandwich', calories: 420, protein_g: 22.0, carbs_g: 35.0, fat_g: 22.0 },
  { name: 'Sausage sandwich', category: 'Breakfast', serving: '1 sandwich', calories: 480, protein_g: 20.0, carbs_g: 36.0, fat_g: 28.0 },
  { name: 'Eggs on toast (2 eggs, 2 slices)', category: 'Breakfast', serving: '1 plate', calories: 380, protein_g: 20.0, carbs_g: 34.0, fat_g: 17.0 },
  { name: 'Pancakes with syrup', category: 'Breakfast', serving: '3 pancakes', calories: 440, protein_g: 10.0, carbs_g: 72.0, fat_g: 12.0 },
  { name: 'Smoothie (banana + berry + protein)', category: 'Drink', serving: '500ml', calories: 310, protein_g: 28.0, carbs_g: 40.0, fat_g: 3.0 },

  // === BRITISH MAINS ===
  { name: 'Fish and chips (medium)', category: 'Takeaway', serving: '1 portion', calories: 840, protein_g: 32.0, carbs_g: 92.0, fat_g: 38.0 },
  { name: 'Chippy chips (medium)', category: 'Takeaway', serving: '1 portion (350g)', calories: 560, protein_g: 6.0, carbs_g: 78.0, fat_g: 24.0 },
  { name: 'Shepherd\'s pie', category: 'British meal', serving: '1 portion (300g)', calories: 380, protein_g: 22.0, carbs_g: 35.0, fat_g: 16.0 },
  { name: 'Cottage pie', category: 'British meal', serving: '1 portion (300g)', calories: 390, protein_g: 24.0, carbs_g: 34.0, fat_g: 16.0 },
  { name: 'Spaghetti bolognese', category: 'Pasta', serving: '1 portion (400g)', calories: 610, protein_g: 32.0, carbs_g: 70.0, fat_g: 22.0 },
  { name: 'Lasagne', category: 'Pasta', serving: '1 portion (350g)', calories: 540, protein_g: 30.0, carbs_g: 48.0, fat_g: 26.0 },
  { name: 'Sausage and mash', category: 'British meal', serving: '2 sausages + mash', calories: 620, protein_g: 24.0, carbs_g: 52.0, fat_g: 35.0 },
  { name: 'Toad in the hole', category: 'British meal', serving: '1 portion', calories: 580, protein_g: 22.0, carbs_g: 50.0, fat_g: 32.0 },
  { name: 'Beef stew and dumplings', category: 'British meal', serving: '1 bowl (400g)', calories: 540, protein_g: 34.0, carbs_g: 42.0, fat_g: 24.0 },
  { name: 'Sunday roast (chicken)', category: 'British meal', serving: '1 full plate', calories: 760, protein_g: 48.0, carbs_g: 65.0, fat_g: 30.0 },
  { name: 'Sunday roast (beef)', category: 'British meal', serving: '1 full plate', calories: 840, protein_g: 52.0, carbs_g: 62.0, fat_g: 38.0 },
  { name: 'Jacket potato with tuna mayo', category: 'British meal', serving: '1 large', calories: 510, protein_g: 28.0, carbs_g: 62.0, fat_g: 16.0 },
  { name: 'Jacket potato with beans & cheese', category: 'British meal', serving: '1 large', calories: 580, protein_g: 22.0, carbs_g: 80.0, fat_g: 18.0 },
  { name: 'Chicken tikka masala with rice', category: 'British meal', serving: '1 portion', calories: 750, protein_g: 38.0, carbs_g: 78.0, fat_g: 28.0 },
  { name: 'Chicken curry with rice', category: 'British meal', serving: '1 portion', calories: 680, protein_g: 36.0, carbs_g: 72.0, fat_g: 24.0 },
  { name: 'Fish pie', category: 'British meal', serving: '1 portion (350g)', calories: 480, protein_g: 30.0, carbs_g: 38.0, fat_g: 22.0 },
  { name: 'Macaroni cheese', category: 'Pasta', serving: '1 portion (350g)', calories: 560, protein_g: 22.0, carbs_g: 52.0, fat_g: 28.0 },
  { name: 'Chilli con carne with rice', category: 'British meal', serving: '1 portion', calories: 620, protein_g: 32.0, carbs_g: 72.0, fat_g: 20.0 },
  { name: 'Chicken Kiev, chips, peas', category: 'British meal', serving: '1 plate', calories: 720, protein_g: 36.0, carbs_g: 58.0, fat_g: 36.0 },
  { name: 'Ham, egg and chips', category: 'British meal', serving: '1 plate', calories: 680, protein_g: 32.0, carbs_g: 60.0, fat_g: 34.0 },

  // === SANDWICHES / LUNCH ===
  { name: 'Chicken sandwich', category: 'Lunch', serving: '1 sandwich', calories: 380, protein_g: 26.0, carbs_g: 38.0, fat_g: 12.0 },
  { name: 'Tuna mayo sandwich', category: 'Lunch', serving: '1 sandwich', calories: 390, protein_g: 22.0, carbs_g: 36.0, fat_g: 16.0 },
  { name: 'BLT sandwich', category: 'Lunch', serving: '1 sandwich', calories: 440, protein_g: 18.0, carbs_g: 38.0, fat_g: 22.0 },
  { name: 'Ham and cheese sandwich', category: 'Lunch', serving: '1 sandwich', calories: 410, protein_g: 22.0, carbs_g: 36.0, fat_g: 18.0 },
  { name: 'Cheese and pickle sandwich', category: 'Lunch', serving: '1 sandwich', calories: 420, protein_g: 16.0, carbs_g: 44.0, fat_g: 18.0 },
  { name: 'Egg mayo sandwich', category: 'Lunch', serving: '1 sandwich', calories: 400, protein_g: 18.0, carbs_g: 36.0, fat_g: 18.0 },
  { name: 'Chicken salad wrap', category: 'Lunch', serving: '1 wrap', calories: 360, protein_g: 24.0, carbs_g: 42.0, fat_g: 10.0 },
  { name: 'Chicken Caesar wrap', category: 'Lunch', serving: '1 wrap', calories: 450, protein_g: 28.0, carbs_g: 44.0, fat_g: 16.0 },
  { name: 'Beef & horseradish sandwich', category: 'Lunch', serving: '1 sandwich', calories: 420, protein_g: 28.0, carbs_g: 38.0, fat_g: 15.0 },
  { name: 'Panini (ham & cheese)', category: 'Lunch', serving: '1 panini', calories: 510, protein_g: 26.0, carbs_g: 50.0, fat_g: 22.0 },

  // === BAKERY / SNACKS ===
  { name: 'Greggs sausage roll', category: 'Bakery', serving: '1 roll', calories: 329, protein_g: 9.2, carbs_g: 26.0, fat_g: 21.0 },
  { name: 'Greggs steak bake', category: 'Bakery', serving: '1 bake', calories: 389, protein_g: 11.4, carbs_g: 28.0, fat_g: 26.0 },
  { name: 'Cornish pasty', category: 'Bakery', serving: '1 pasty', calories: 490, protein_g: 14.0, carbs_g: 46.0, fat_g: 28.0 },
  { name: 'Pork pie', category: 'Bakery', serving: '1 individual', calories: 360, protein_g: 10.0, carbs_g: 24.0, fat_g: 25.0 },
  { name: 'Scotch egg', category: 'Snack', serving: '1 egg', calories: 290, protein_g: 14.0, carbs_g: 16.0, fat_g: 19.0 },
  { name: 'Croissant', category: 'Bakery', serving: '1 croissant', calories: 290, protein_g: 6.0, carbs_g: 31.0, fat_g: 15.0 },
  { name: 'Pain au chocolat', category: 'Bakery', serving: '1', calories: 320, protein_g: 6.0, carbs_g: 34.0, fat_g: 18.0 },
  { name: 'Chocolate muffin', category: 'Bakery', serving: '1 muffin', calories: 440, protein_g: 6.0, carbs_g: 58.0, fat_g: 20.0 },
  { name: 'Blueberry muffin', category: 'Bakery', serving: '1 muffin', calories: 390, protein_g: 5.0, carbs_g: 56.0, fat_g: 16.0 },
  { name: 'Flapjack', category: 'Snack', serving: '1 bar (60g)', calories: 260, protein_g: 3.5, carbs_g: 34.0, fat_g: 12.0 },
  { name: 'Mars bar', category: 'Snack', serving: '1 standard', calories: 230, protein_g: 2.2, carbs_g: 35.0, fat_g: 8.9 },
  { name: 'Snickers', category: 'Snack', serving: '1 standard', calories: 245, protein_g: 3.9, carbs_g: 27.0, fat_g: 12.0 },
  { name: 'Mini cheddars', category: 'Snack', serving: '50g bag', calories: 260, protein_g: 6.0, carbs_g: 27.0, fat_g: 14.0 },
  { name: 'Walkers crisps (ready salted)', category: 'Snack', serving: '25g bag', calories: 129, protein_g: 1.5, carbs_g: 13.0, fat_g: 8.0 },
  { name: 'Digestive biscuit', category: 'Snack', serving: '1 biscuit', calories: 71, protein_g: 1.1, carbs_g: 10.0, fat_g: 3.0 },
  { name: 'Protein bar', category: 'Snack', serving: '1 bar (60g)', calories: 200, protein_g: 20.0, carbs_g: 20.0, fat_g: 6.0 },

  // === TAKEAWAYS ===
  { name: 'Pizza Margherita (medium slice)', category: 'Takeaway', serving: '1 slice', calories: 250, protein_g: 10.0, carbs_g: 32.0, fat_g: 10.0 },
  { name: 'Pizza Pepperoni (medium slice)', category: 'Takeaway', serving: '1 slice', calories: 290, protein_g: 12.0, carbs_g: 30.0, fat_g: 14.0 },
  { name: 'Domino\'s medium pizza (whole)', category: 'Takeaway', serving: '1 whole', calories: 1800, protein_g: 80.0, carbs_g: 220.0, fat_g: 72.0 },
  { name: 'Chicken kebab (doner)', category: 'Takeaway', serving: '1 pitta', calories: 680, protein_g: 38.0, carbs_g: 52.0, fat_g: 36.0 },
  { name: 'Chicken shawarma wrap', category: 'Takeaway', serving: '1 wrap', calories: 540, protein_g: 36.0, carbs_g: 48.0, fat_g: 22.0 },
  { name: 'McDonald\'s Big Mac', category: 'Takeaway', serving: '1 burger', calories: 508, protein_g: 26.0, carbs_g: 44.0, fat_g: 25.0 },
  { name: 'McDonald\'s medium fries', category: 'Takeaway', serving: '1 portion', calories: 333, protein_g: 4.0, carbs_g: 42.0, fat_g: 16.0 },
  { name: 'McDonald\'s Chicken McNuggets (6)', category: 'Takeaway', serving: '6 pieces', calories: 259, protein_g: 15.0, carbs_g: 16.0, fat_g: 16.0 },
  { name: 'KFC chicken breast', category: 'Takeaway', serving: '1 piece', calories: 370, protein_g: 40.0, carbs_g: 11.0, fat_g: 19.0 },
  { name: 'Nando\'s chicken burger', category: 'Takeaway', serving: '1 burger', calories: 540, protein_g: 38.0, carbs_g: 50.0, fat_g: 20.0 },
  { name: 'Subway Footlong (chicken)', category: 'Takeaway', serving: '1 footlong', calories: 620, protein_g: 40.0, carbs_g: 80.0, fat_g: 14.0 },
  { name: 'Chinese chicken chow mein', category: 'Takeaway', serving: '1 portion', calories: 680, protein_g: 32.0, carbs_g: 78.0, fat_g: 24.0 },
  { name: 'Sweet and sour chicken with rice', category: 'Takeaway', serving: '1 portion', calories: 720, protein_g: 26.0, carbs_g: 92.0, fat_g: 22.0 },
  { name: 'Chicken fried rice', category: 'Takeaway', serving: '1 portion', calories: 560, protein_g: 26.0, carbs_g: 78.0, fat_g: 14.0 },

  // === DAIRY & PROTEIN ===
  { name: 'Whole milk', category: 'Dairy', serving: '250ml glass', calories: 160, protein_g: 8.2, carbs_g: 11.8, fat_g: 9.5 },
  { name: 'Cheddar cheese', category: 'Dairy', serving: '30g slice', calories: 125, protein_g: 7.6, carbs_g: 0.1, fat_g: 10.3 },
  { name: 'Cottage cheese', category: 'Dairy', serving: '100g', calories: 98, protein_g: 11.0, carbs_g: 3.4, fat_g: 4.3 },
  { name: 'Mozzarella', category: 'Dairy', serving: '30g', calories: 90, protein_g: 6.3, carbs_g: 0.7, fat_g: 6.7 },
  { name: 'Natural yoghurt', category: 'Dairy', serving: '150g pot', calories: 90, protein_g: 6.5, carbs_g: 8.5, fat_g: 3.5 },
  { name: 'Chicken thigh, cooked', category: 'Protein', serving: '150g', calories: 278, protein_g: 40.0, carbs_g: 0, fat_g: 13.0 },
  { name: 'Beef mince (5% fat), cooked', category: 'Protein', serving: '150g', calories: 255, protein_g: 39.0, carbs_g: 0, fat_g: 10.5 },
  { name: 'Tuna steak, grilled', category: 'Protein', serving: '150g', calories: 210, protein_g: 45.0, carbs_g: 0, fat_g: 3.0 },
  { name: 'Salmon fillet, grilled', category: 'Protein', serving: '150g', calories: 310, protein_g: 35.0, carbs_g: 0, fat_g: 18.0 },
  { name: 'Cod fillet, baked', category: 'Protein', serving: '150g', calories: 130, protein_g: 29.0, carbs_g: 0, fat_g: 1.5 },
  { name: 'Prawns, cooked', category: 'Protein', serving: '100g', calories: 99, protein_g: 24.0, carbs_g: 0, fat_g: 0.3 },
  { name: 'Tuna in brine (tin)', category: 'Protein', serving: '130g drained', calories: 135, protein_g: 31.0, carbs_g: 0, fat_g: 0.8 },

  // === VEG & SIDES ===
  { name: 'Baked beans', category: 'Veg', serving: '200g half-tin', calories: 155, protein_g: 9.5, carbs_g: 26.0, fat_g: 0.8 },
  { name: 'Broccoli, steamed', category: 'Veg', serving: '100g', calories: 35, protein_g: 3.0, carbs_g: 5.0, fat_g: 0.4 },
  { name: 'Peas, cooked', category: 'Veg', serving: '80g', calories: 67, protein_g: 5.0, carbs_g: 9.0, fat_g: 1.3 },
  { name: 'Carrots, cooked', category: 'Veg', serving: '80g', calories: 28, protein_g: 0.7, carbs_g: 6.0, fat_g: 0.2 },
  { name: 'Mashed potato', category: 'Veg', serving: '180g', calories: 190, protein_g: 3.6, carbs_g: 30.0, fat_g: 6.0 },
  { name: 'Roast potatoes', category: 'Veg', serving: '150g', calories: 225, protein_g: 4.0, carbs_g: 32.0, fat_g: 9.0 },
  { name: 'Oven chips', category: 'Veg', serving: '150g', calories: 240, protein_g: 3.5, carbs_g: 36.0, fat_g: 9.0 },
  { name: 'Sweet potato, baked', category: 'Veg', serving: '200g', calories: 180, protein_g: 4.0, carbs_g: 42.0, fat_g: 0.2 },
  { name: 'Salad (mixed leaves)', category: 'Veg', serving: '100g', calories: 20, protein_g: 1.4, carbs_g: 2.9, fat_g: 0.3 },
  { name: 'Tomato', category: 'Veg', serving: '1 medium', calories: 22, protein_g: 1.1, carbs_g: 4.8, fat_g: 0.2 },
  { name: 'Cucumber', category: 'Veg', serving: '100g', calories: 15, protein_g: 0.7, carbs_g: 3.6, fat_g: 0.1 },
  { name: 'Avocado', category: 'Veg', serving: 'half (70g)', calories: 112, protein_g: 1.4, carbs_g: 6.0, fat_g: 10.3 },

  // === FRUIT ===
  { name: 'Orange', category: 'Fruit', serving: '1 medium', calories: 62, protein_g: 1.2, carbs_g: 15.0, fat_g: 0.2 },
  { name: 'Grapes', category: 'Fruit', serving: '100g', calories: 69, protein_g: 0.7, carbs_g: 18.0, fat_g: 0.2 },
  { name: 'Strawberries', category: 'Fruit', serving: '100g', calories: 32, protein_g: 0.7, carbs_g: 7.7, fat_g: 0.3 },
  { name: 'Blueberries', category: 'Fruit', serving: '100g', calories: 57, protein_g: 0.7, carbs_g: 14.5, fat_g: 0.3 },
  { name: 'Pear', category: 'Fruit', serving: '1 medium', calories: 100, protein_g: 0.6, carbs_g: 27.0, fat_g: 0.2 },
  { name: 'Raisins', category: 'Fruit', serving: '40g handful', calories: 120, protein_g: 1.2, carbs_g: 32.0, fat_g: 0.2 },
  { name: 'Watermelon', category: 'Fruit', serving: '200g', calories: 60, protein_g: 1.2, carbs_g: 15.0, fat_g: 0.3 },
  { name: 'Pineapple chunks', category: 'Fruit', serving: '150g', calories: 75, protein_g: 0.8, carbs_g: 20.0, fat_g: 0.2 },

  // === DRINKS ===
  { name: 'Lucozade Sport', category: 'Drink', serving: '500ml', calories: 140, protein_g: 0, carbs_g: 35.0, fat_g: 0 },
  { name: 'Coca-Cola', category: 'Drink', serving: '330ml can', calories: 139, protein_g: 0, carbs_g: 35.0, fat_g: 0 },
  { name: 'Diet Coke', category: 'Drink', serving: '330ml can', calories: 1, protein_g: 0, carbs_g: 0, fat_g: 0 },
  { name: 'Orange juice', category: 'Drink', serving: '250ml glass', calories: 115, protein_g: 1.7, carbs_g: 27.0, fat_g: 0.3 },
  { name: 'Water', category: 'Drink', serving: '500ml', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  { name: 'Tea with milk', category: 'Drink', serving: '1 cup', calories: 15, protein_g: 0.7, carbs_g: 1.5, fat_g: 0.6 },
  { name: 'Coffee with milk', category: 'Drink', serving: '1 cup', calories: 20, protein_g: 1.0, carbs_g: 2.0, fat_g: 0.8 },
  { name: 'Hot chocolate', category: 'Drink', serving: '250ml', calories: 190, protein_g: 8.0, carbs_g: 30.0, fat_g: 5.0 },
  { name: 'Red Bull', category: 'Drink', serving: '250ml can', calories: 110, protein_g: 0.3, carbs_g: 28.0, fat_g: 0 },
  { name: 'Protein water', category: 'Drink', serving: '500ml', calories: 85, protein_g: 20.0, carbs_g: 2.0, fat_g: 0 },

  // === SCHOOL DINNERS ===
  { name: 'School meal – pasta bake', category: 'School', serving: '1 portion', calories: 520, protein_g: 22.0, carbs_g: 58.0, fat_g: 22.0 },
  { name: 'School meal – roast dinner', category: 'School', serving: '1 portion', calories: 620, protein_g: 32.0, carbs_g: 64.0, fat_g: 24.0 },
  { name: 'School meal – fish and chips', category: 'School', serving: '1 portion', calories: 680, protein_g: 28.0, carbs_g: 78.0, fat_g: 28.0 },
  { name: 'School meal – chicken curry', category: 'School', serving: '1 portion', calories: 560, protein_g: 28.0, carbs_g: 68.0, fat_g: 18.0 },
  { name: 'School meal – jacket potato', category: 'School', serving: '1 portion', calories: 420, protein_g: 18.0, carbs_g: 60.0, fat_g: 12.0 },
]

// Pre-compute a lowercase search index
export const FOOD_SEARCH_INDEX = UK_FOODS.map(f => ({
  ...f,
  _search: (f.name + ' ' + f.category + ' ' + (f.tags ?? []).join(' ')).toLowerCase(),
}))

export function searchFoods(q: string, limit = 20): UkFood[] {
  const query = q.trim().toLowerCase()
  if (!query) return UK_FOODS.filter(f => f.quick).slice(0, limit)
  const terms = query.split(/\s+/).filter(Boolean)
  const scored = FOOD_SEARCH_INDEX
    .map(f => {
      let score = 0
      for (const t of terms) {
        if (f._search.includes(t)) score += 1
        if (f.name.toLowerCase().startsWith(t)) score += 2
      }
      return { f, score }
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
  return scored.map(s => s.f)
}

export const QUICK_PICKS = UK_FOODS.filter(f => f.quick)
