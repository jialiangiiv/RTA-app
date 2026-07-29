import { db } from "../core/db";
import { newId } from "../core/ids";
import { User } from "../models/types";

export const usersService = {
  list(): User[] {
    return db.prepare("SELECT * FROM users").all() as User[];
  },

  get(id: string): User | undefined {
    return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
  },

  findByDisplayName(displayName: string): User | undefined {
    return db.prepare("SELECT * FROM users WHERE display_name = ?").get(displayName) as User | undefined;
  },

  create(input: { display_name: string }): User {
    const user: User = { id: newId(), display_name: input.display_name };
    db.prepare("INSERT INTO users (id, display_name) VALUES (@id, @display_name)").run(user);
    return user;
  },
};
