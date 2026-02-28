CREATE TABLE `invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`email` varchar(320),
	`role` enum('administrador','diretor','supervisor','operador') NOT NULL,
	`name` varchar(255),
	`usedAt` timestamp,
	`usedByUserId` int,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `invites_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','administrador','diretor','supervisor','operador') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `ownerId` int;