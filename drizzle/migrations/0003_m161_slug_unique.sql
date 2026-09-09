UPDATE "wedding_projects" SET "slug" = "id" WHERE "slug" = '';
CREATE UNIQUE INDEX "projects_slug_unique" ON "wedding_projects" USING btree ("slug");