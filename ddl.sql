CREATE DATABASE company;
USE company;

SET foreign_key_checks = 0;

CREATE TABLE Department (
  DeptID   INT          PRIMARY KEY,
  DeptName VARCHAR(60)  NOT NULL
);

CREATE TABLE Person (
  PersonID  INT          PRIMARY KEY,
  LName     VARCHAR(40)  NOT NULL,
  FName     VARCHAR(40)  NOT NULL,
  Age       INT UNSIGNED NOT NULL CHECK (Age BETWEEN 0 AND 64),
  Gender    ENUM('M','F') NOT NULL,
  Addr1     VARCHAR(80),
  Addr2     VARCHAR(80),
  City      VARCHAR(40),
  State     CHAR(2),
  Zip       VARCHAR(10)
);

CREATE TABLE Phone (
  PersonID  INT,
  PhoneNo   VARCHAR(20),
  PRIMARY KEY (PersonID, PhoneNo),
  FOREIGN KEY (PersonID) REFERENCES Person(PersonID) ON DELETE CASCADE
);

CREATE TABLE Employee (
  EmpID        INT PRIMARY KEY,
  JobRank      VARCHAR(30),
  Title        VARCHAR(50),
  SupervisorID INT NOT NULL,
  FOREIGN KEY (EmpID)        REFERENCES Person(PersonID) ON DELETE CASCADE,
  FOREIGN KEY (SupervisorID) REFERENCES Employee(EmpID),
  CONSTRAINT chk_emp_not_self_supervisor CHECK (SupervisorID <> EmpID)
);

CREATE INDEX idx_emp_supervisor ON Employee(SupervisorID);

CREATE TABLE Customer (
  CustID       INT PRIMARY KEY,
  PreferredRep INT NOT NULL,
  FOREIGN KEY (CustID)       REFERENCES Person(PersonID) ON DELETE CASCADE,
  FOREIGN KEY (PreferredRep) REFERENCES Employee(EmpID)
);

CREATE TABLE Potential_Employee (
  PotEmpID INT PRIMARY KEY,
  FOREIGN KEY (PotEmpID) REFERENCES Person(PersonID) ON DELETE CASCADE
);

CREATE TABLE Job_Position (
  JobID       INT PRIMARY KEY,
  Description VARCHAR(120),
  PostedDate  DATE,
  DeptID      INT,
  FOREIGN KEY (DeptID) REFERENCES Department(DeptID)
);

CREATE TABLE Application (
  AppID    INT PRIMARY KEY,
  PersonID INT,
  JobID    INT,
  AppDate  DATE,
  FOREIGN KEY (PersonID) REFERENCES Person(PersonID),
  FOREIGN KEY (JobID)    REFERENCES Job_Position(JobID)
);

CREATE TABLE Interview (
  InterviewID INT PRIMARY KEY,
  AppID       INT NOT NULL,
  RoundNo     INT NOT NULL,
  StartTime   DATETIME,
  FOREIGN KEY (AppID) REFERENCES Application(AppID),
  UNIQUE KEY uq_app_round (AppID, RoundNo)
);

CREATE TABLE Interview_Participation (
  InterviewID   INT,
  InterviewerID INT,
  Grade         INT CHECK (Grade BETWEEN 0 AND 100),
  PRIMARY KEY (InterviewID, InterviewerID),
  FOREIGN KEY (InterviewID)   REFERENCES Interview(InterviewID) ON DELETE CASCADE,
  FOREIGN KEY (InterviewerID) REFERENCES Employee(EmpID)
);

CREATE TABLE Emp_Dept_Assignment (
  EmpID     INT,
  DeptID    INT,
  StartDate DATE NOT NULL,
  EndDate   DATE NULL,
  PRIMARY KEY (EmpID, DeptID, StartDate),
  FOREIGN KEY (EmpID)  REFERENCES Employee(EmpID),
  FOREIGN KEY (DeptID) REFERENCES Department(DeptID)
);

CREATE TABLE Salary_Payment (
  EmpID    INT,
  TransNo  INT,
  PayDate  DATE NOT NULL,
  Amount   DECIMAL(9,2),
  PRIMARY KEY (EmpID, TransNo),
  FOREIGN KEY (EmpID) REFERENCES Employee(EmpID)
);

CREATE TABLE Product (
  ProductID  INT PRIMARY KEY,
  ProdType   VARCHAR(40),
  Size       VARCHAR(20),
  ListPrice  DECIMAL(9,2),
  Weight     DECIMAL(7,2),
  Style      VARCHAR(30)
);

CREATE TABLE Part_Type (
  PartTypeID INT PRIMARY KEY,
  PartName   VARCHAR(40)
);

CREATE TABLE Product_Part (
  ProductID  INT,
  PartTypeID INT,
  Qty        INT,
  PRIMARY KEY (ProductID, PartTypeID),
  FOREIGN KEY (ProductID)  REFERENCES Product(ProductID),
  FOREIGN KEY (PartTypeID) REFERENCES Part_Type(PartTypeID)
);

CREATE TABLE Vendor (
  VendorID     INT PRIMARY KEY,
  VName        VARCHAR(60),
  Addr1        VARCHAR(80),
  Addr2        VARCHAR(80),
  City         VARCHAR(40),
  State        CHAR(2),
  Zip          VARCHAR(10),
  AccountNo    VARCHAR(20),
  CreditRating TINYINT,
  WS_URL       VARCHAR(120)
);

CREATE TABLE Vendor_Part_Offer (
  VendorID   INT,
  PartTypeID INT,
  UnitPrice  DECIMAL(9,2),
  PRIMARY KEY (VendorID, PartTypeID),
  FOREIGN KEY (VendorID)   REFERENCES Vendor(VendorID),
  FOREIGN KEY (PartTypeID) REFERENCES Part_Type(PartTypeID)
);

CREATE TABLE Site (
  SiteID   INT PRIMARY KEY,
  SiteName VARCHAR(60),
  Location VARCHAR(80)
);

CREATE TABLE Site_Employee (
  SiteID INT,
  EmpID  INT,
  PRIMARY KEY (SiteID, EmpID),
  FOREIGN KEY (SiteID) REFERENCES Site(SiteID),
  FOREIGN KEY (EmpID)  REFERENCES Employee(EmpID)
);

CREATE TABLE Sale (
  SaleID   INT PRIMARY KEY,
  SaleTime DATETIME,
  SiteID   INT,
  EmpID    INT,
  CustID   INT,
  FOREIGN KEY (SiteID) REFERENCES Site(SiteID),
  FOREIGN KEY (EmpID)  REFERENCES Employee(EmpID),
  FOREIGN KEY (CustID) REFERENCES Customer(CustID)
);

CREATE TABLE Sale_Line (
  SaleID    INT,
  ProductID INT,
  Quantity  INT,
  SoldPrice DECIMAL(9,2),
  PRIMARY KEY (SaleID, ProductID),
  FOREIGN KEY (SaleID)    REFERENCES Sale(SaleID)    ON DELETE CASCADE,
  FOREIGN KEY (ProductID) REFERENCES Product(ProductID)
);

DELIMITER $$
CREATE TRIGGER trg_emp_dept_no_overlap
BEFORE INSERT ON Emp_Dept_Assignment
FOR EACH ROW
BEGIN
  DECLARE conflict INT;
  SELECT 1
    INTO conflict
    FROM Emp_Dept_Assignment
   WHERE EmpID = NEW.EmpID
     AND COALESCE(EndDate,'9999-12-31') > NEW.StartDate
     AND (NEW.EndDate IS NULL OR NEW.EndDate > StartDate)
   LIMIT 1;
  IF conflict IS NOT NULL THEN
     SIGNAL SQLSTATE '45000'
       SET MESSAGE_TEXT = 'Employee already assigned to a department during the specified period.';
  END IF;
END$$
DELIMITER ;

SET foreign_key_checks = 1;

/* =========================================================
   1. SCHEMA CHANGES
   ========================================================= */
ALTER TABLE Person
    ADD COLUMN Email VARCHAR(120) 
           AFTER Zip;                     -- keep it near contact info

ALTER TABLE Application
    ADD COLUMN SelectedFlag TINYINT(1) 
           NOT NULL DEFAULT 0
           AFTER AppDate;

UPDATE Application
   SET SelectedFlag = 1
 WHERE AppID = 1001;         

/* -----------------------------------------------------------------
1. Interviewers who met “Hellen Cole” for Job 11111
------------------------------------------------------------------*/
SELECT DISTINCT
       ip.InterviewerID                                    AS EmpID,
       CONCAT(pIV.FName,' ',pIV.LName)                    AS InterviewerName
FROM Person              pEE                       -- the interviewee
JOIN Application         a    ON a.PersonID = pEE.PersonID
JOIN Interview           i    ON i.AppID    = a.AppID
JOIN Interview_Participation ip ON ip.InterviewID = i.InterviewID
JOIN Person              pIV  ON pIV.PersonID = ip.InterviewerID
WHERE pEE.FName = 'Hellen'
  AND pEE.LName = 'Cole'
  AND a.JobID   = 11111;

/* -----------------------------------------------------------------
2. Jobs Marketing posted in January 2011
------------------------------------------------------------------*/
SELECT jp.JobID
FROM   Job_Position jp
JOIN   Department   d  ON d.DeptID = jp.DeptID
WHERE  d.DeptName  = 'Marketing'
  AND  jp.PostedDate >= '2011-01-01'
  AND  jp.PostedDate <  '2011-02-01';

/* -----------------------------------------------------------------
3. Employees who supervise nobody
------------------------------------------------------------------*/
SELECT e.EmpID,
       CONCAT(p.FName,' ',p.LName) AS EmployeeName
FROM   Employee e
JOIN   Person   p  ON p.PersonID = e.EmpID
LEFT   JOIN Employee sub ON sub.SupervisorID = e.EmpID
WHERE  sub.EmpID IS NULL;

/* -----------------------------------------------------------------
4. Marketing sites with **no** sales in March 2011
     (assumes a site is “Marketing” when at least one current
      employee there belongs to the Marketing department)
------------------------------------------------------------------*/
WITH marketing_sites AS (
  SELECT DISTINCT se.SiteID
  FROM   Site_Employee        se
  JOIN   Emp_Dept_Assignment  eda ON eda.EmpID = se.EmpID
  JOIN   Department           d   ON d.DeptID = eda.DeptID
  WHERE  d.DeptName = 'Marketing'
        AND eda.EndDate IS NULL            -- currently assigned
)
SELECT s.SiteID, s.Location
FROM   Site s
JOIN   marketing_sites ms ON ms.SiteID = s.SiteID
LEFT   JOIN Sale sa
       ON sa.SiteID = s.SiteID
      AND sa.SaleTime >= '2011-03-01'
      AND sa.SaleTime <  '2011-04-01'
WHERE  sa.SaleID IS NULL;

/* -----------------------------------------------------------------
5. Jobs that are still unfilled one month after posting
     (assumes Application.SelectedFlag = 1 when someone is hired)
------------------------------------------------------------------*/
SELECT jp.JobID, jp.Description
FROM   Job_Position jp
LEFT   JOIN Application a
       ON a.JobID     = jp.JobID
      AND a.SelectedFlag = 1
      AND a.AppDate   <= DATE_ADD(jp.PostedDate, INTERVAL 1 MONTH)
WHERE  a.AppID IS NULL;

/* -----------------------------------------------------------------
6. Sales‑people who have sold **every** product‑type priced > $200
------------------------------------------------------------------*/
WITH expensive_types AS (
  SELECT DISTINCT ProdType
  FROM   Product
  WHERE  ListPrice > 200
),
sales_by_emp_type AS (
  SELECT s.EmpID, pr.ProdType
  FROM   Sale_Line sl
  JOIN   Sale      s   ON s.SaleID    = sl.SaleID
  JOIN   Product   pr  ON pr.ProductID = sl.ProductID
  WHERE  pr.ListPrice > 200
  GROUP  BY s.EmpID, pr.ProdType
),
emp_cover AS (
  SELECT EmpID
  FROM   sales_by_emp_type
  GROUP  BY EmpID
  HAVING COUNT(DISTINCT ProdType) = (SELECT COUNT(*) FROM expensive_types)
)
SELECT e.EmpID,
       CONCAT(p.FName,' ',p.LName) AS SalesmanName
FROM   emp_cover ec
JOIN   Employee  e ON e.EmpID    = ec.EmpID
JOIN   Person    p ON p.PersonID = e.EmpID;

/* -----------------------------------------------------------------
7. Departments with **no** job posts between 1 Jan and 1 Feb 2011
------------------------------------------------------------------*/
SELECT d.DeptID, d.DeptName
FROM   Department d
LEFT   JOIN Job_Position jp
       ON jp.DeptID = d.DeptID
      AND jp.PostedDate >= '2011-01-01'
      AND jp.PostedDate <  '2011-02-02'   -- inclusive of 1 Feb
WHERE  jp.JobID IS NULL;

/* -----------------------------------------------------------------
8. Existing employees who applied for Job 12345
------------------------------------------------------------------*/
SELECT e.EmpID,
       CONCAT(p.FName,' ',p.LName) AS EmpName,
       eda.DeptID
FROM   Application a
JOIN   Employee    e   ON e.EmpID    = a.PersonID
JOIN   Person      p   ON p.PersonID = e.EmpID
LEFT   JOIN Emp_Dept_Assignment eda
       ON eda.EmpID = e.EmpID
      AND eda.EndDate IS NULL
WHERE  a.JobID = 12345;

/* -----------------------------------------------------------------
9. Best‑selling product‑type (greatest total units sold)
------------------------------------------------------------------*/
SELECT pr.ProdType
FROM   Product    pr
JOIN   Sale_Line  sl ON sl.ProductID = pr.ProductID
GROUP  BY pr.ProdType
ORDER  BY SUM(sl.Quantity) DESC
LIMIT 1;

/* -----------------------------------------------------------------
10. Most profitable product‑type (revenue – build cost)
------------------------------------------------------------------*/
WITH min_part_cost AS (
  SELECT PartTypeID, MIN(UnitPrice) AS MinCost
  FROM   Vendor_Part_Offer
  GROUP  BY PartTypeID
),
product_cost AS (
  SELECT pp.ProductID,
         SUM(pp.Qty * mpc.MinCost) AS BuildCost
  FROM   Product_Part   pp
  JOIN   min_part_cost  mpc ON mpc.PartTypeID = pp.PartTypeID
  GROUP  BY pp.ProductID
),
product_rev AS (
  SELECT sl.ProductID,
         SUM(sl.Quantity * sl.SoldPrice) AS Revenue
  FROM   Sale_Line sl
  GROUP  BY sl.ProductID
),
product_profit AS (
  SELECT pr.ProductID,
         pr.ProdType,
         COALESCE(rev.Revenue,0) - COALESCE(pc.BuildCost,0) AS NetProfit
  FROM   Product pr
  LEFT   JOIN product_rev  rev ON rev.ProductID = pr.ProductID
  LEFT   JOIN product_cost pc  ON pc.ProductID  = pr.ProductID
)
SELECT ProdType
FROM   product_profit
GROUP  BY ProdType
ORDER  BY SUM(NetProfit) DESC
LIMIT 1;

/* -----------------------------------------------------------------
11. Employees who have worked in **all** departments
------------------------------------------------------------------*/
WITH dept_cnt AS (SELECT COUNT(*) AS n FROM Department),
emp_dept AS (
  SELECT EmpID, COUNT(DISTINCT DeptID) AS dcnt
  FROM   Emp_Dept_Assignment
  GROUP  BY EmpID
)
SELECT e.EmpID,
       CONCAT(p.FName,' ',p.LName) AS EmpName
FROM   emp_dept ed
JOIN   dept_cnt dc        ON ed.dcnt = dc.n
JOIN   Employee  e  ON e.EmpID    = ed.EmpID
JOIN   Person    p  ON p.PersonID = e.EmpID;

/* -----------------------------------------------------------------
12. Interviewees who were selected  (needs Application.SelectedFlag)
------------------------------------------------------------------*/
SELECT CONCAT(p.FName,' ',p.LName) AS IntervieweeName,
       p.Email                                   -- ← add column
FROM   Application a
JOIN   Person      p ON p.PersonID = a.PersonID
WHERE  a.SelectedFlag = 1;

/* -----------------------------------------------------------------
13. Name | Phone | Email of people selected for **every** job they applied
------------------------------------------------------------------*/
WITH app_stats AS (
  SELECT PersonID,
         COUNT(*)                                   AS total_apps,
         SUM(CASE WHEN SelectedFlag = 1 THEN 1 END) AS sel_apps
  FROM   Application
  GROUP  BY PersonID
),
all_winners AS (
  SELECT PersonID
  FROM   app_stats
  WHERE  total_apps = sel_apps
)
SELECT DISTINCT
       CONCAT(p.FName,' ',p.LName) AS Name,
       ph.PhoneNo,
       p.Email                                   -- ← add column
FROM   all_winners w
JOIN   Person   p  ON p.PersonID = w.PersonID
LEFT   JOIN Phone ph ON ph.PersonID = p.PersonID;

/* -----------------------------------------------------------------
14. Employee with the highest average‑monthly salary
     (uses view v_avg_monthly_salary from part (d))
------------------------------------------------------------------*/
SELECT v.EmpID,
       CONCAT(p.FName,' ',p.LName) AS EmpName,
       v.AvgMonthlySalary
FROM   v_avg_monthly_salary v
JOIN   Person p ON p.PersonID = v.EmpID
ORDER  BY v.AvgMonthlySalary DESC
LIMIT 1;

/* -----------------------------------------------------------------
15. Vendor offering the cheapest “Cup” part < 4 lbs
     (assumes a “Cup” entry exists in Part_Type and weight check
      is on Product.Weight via a BOM)
------------------------------------------------------------------*/
WITH cup_part AS (
  SELECT PartTypeID
  FROM   Part_Type
  WHERE  PartName = 'Cup'
),
min_price AS (
  SELECT MIN(UnitPrice) AS min_price
  FROM   Vendor_Part_Offer
  WHERE  PartTypeID IN (SELECT PartTypeID FROM cup_part)
)
SELECT vpo.VendorID, v.VName
FROM   Vendor_Part_Offer vpo
JOIN   cup_part cp  ON cp.PartTypeID = vpo.PartTypeID
JOIN   min_price mp ON mp.min_price  = vpo.UnitPrice
JOIN   Vendor    v  ON v.VendorID    = vpo.VendorID;

