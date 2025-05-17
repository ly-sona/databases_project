import random
import mysql.connector
from faker import Faker


def main() -> None:
    fake = Faker()
    Faker.seed(0)                     

    cnx = mysql.connector.connect(
        host="localhost",
        user="root",
        password="YOUR_PASSWORD",
        database="company",
        autocommit=False,
    )
    cur = cnx.cursor()

    cur.execute("SET foreign_key_checks = 0")

    person_sql = """
        INSERT INTO Person
            (PersonID, LName, FName, Age, Gender,
             Addr1, Addr2, City, State, Zip, Email)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """
    people = []
    for pid in range(1, 151):
        gender = random.choice(["M", "F"])
        first  = fake.first_name_male() if gender == "M" else fake.first_name_female()
        last   = fake.last_name()
        age    = random.randint(18, 64)          # respects CHECK (Age BETWEEN 0 AND 64)
        addr1  = fake.street_address()
        addr2  = fake.secondary_address() if random.random() < 0.25 else None
        city   = fake.city()
        state  = fake.state_abbr()
        zip_   = fake.postcode()
        email  = fake.email()
        people.append(
            (pid, last, first, age, gender, addr1, addr2, city, state, zip_, email)
        )

    cur.executemany(person_sql, people)
    print(f"→ 150 Person rows inserted")

    job_ranks = ["Junior", "Mid", "Senior", "Lead"]
    titles    = [
        "Developer", "Analyst", "Engineer",
        "Consultant", "Manager", "Specialist"
    ]
    emp_sql = """
        INSERT INTO Employee (EmpID, JobRank, Title, SupervisorID)
        VALUES (%s,%s,%s,%s)
    """

    employees = []
    for eid in range(1, 101):
        job_rank = random.choice(job_ranks)
        title    = random.choice(titles)

        valid_supervisors = list(range(1, eid)) or [eid + 1] 
        supervisor_id     = random.choice(valid_supervisors)

        employees.append((eid, job_rank, title, supervisor_id))

    cur.executemany(emp_sql, employees)
    print(f"→ 100 Employee rows inserted")

    # ─── 5.  RE‑ENABLE FK CHECKS & COMMIT ──────────────────────────────────────
    cur.execute("SET foreign_key_checks = 1")
    cnx.commit()
    print("✓  All data committed.\n")

    # ─── 6.  CLEANUP ───────────────────────────────────────────────────────────
    cur.close()
    cnx.close()


if __name__ == "__main__":
    main()
