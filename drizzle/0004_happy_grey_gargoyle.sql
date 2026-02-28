CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`taskId` int,
	`type` enum('prazo_proximo','atrasada','concluida','sistema') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`read` enum('0','1') NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
