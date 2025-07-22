export interface CalculatedOrder {
  id: string;
  total_amount: string;
  free_delivery: boolean;
  delivery_fee: string;
  service_charge: string;
  address_details: AddressDetails;
  meals: CalculatedOrderMeal[];
  amount: number;
  internal_profit: number;
  lat: string;
  lng: string;
  cokitchen_polygon_id: string;
  user_id: string;
  cokitchen_id: string;
  pickup: boolean;
  prev_price: string;
}

export interface AddressDetails {
  city: string;
  name: string;
  address_line: string;
  building_number: string;
}

export interface CalculatedOrderMeal {
  brand: Brand;
  meals: Meal[];
  amount: number;
  internal_profit: number;
}

export interface Brand {
  id: string;
  name: string;
}

export interface Meal {
  id: string;
  new: boolean;
  name: string;
  brand: Brand;
  active: boolean;
  addons: Addon[];
  amount: string;
  images: string[];
  alcohol: boolean;
  item_no: string | null;
  summary: string | null;
  brand_id: string;
  calories: string;
  is_addon: boolean;
  is_combo: boolean;
  position: number;
  quantity: number;
  home_page: boolean;
  item_type: string;
  meal_tags: string[];
  created_at: string;
  is_deleted: boolean;
  order_note: string;
  updated_at: string;
  description: string;
  minimum_age: string;
  posist_data: object;
  available_no: string;
  meal_keywords: string[];
  internal_profit: number;
  meal_category_id: string;
}

export interface Addon {
  id: string;
  amount: number;
  meal_id: string;
  meal_data: object;
  created_at: string;
  updated_at: string;
  meal_addon_id: string;
  internal_profit: number;
  min_selection_no: string;
  meal_addon_category_id: string;
  images?: object;
  is_combo?: boolean;
  position?: number;
  quantity?: number;
  posist_data?: object;
} 