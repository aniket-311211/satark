import random

from locust import HttpUser, between, task

NAMES = [
    "Rajiv Sanghvi", "श्री राजीव संघवी", "R. K. Srivastava", "Shinde Sambhaji Rao", "Md. Hafiz Saeed",
    "Umashankar Srivastava", "Priya Sharma", "Ananya Iyer", "M/s Shivsathi Mercantile Pvt Ltd",
    "Rameshbhai Patel S/O Kantilal", "Vaibhav Gandhi", "संभाजी राव शिंदे", "Arjun Mehta", "Sai Nagarajan",
]


class Analyst(HttpUser):
    wait_time = between(0.01, 0.05)

    @task
    def screen(self):
        self.client.post("/screen", json={"name": random.choice(NAMES), "limit": 5}, name="/screen")
