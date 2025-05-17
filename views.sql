/* View 1: Average monthly salary per employee (average of monthly totals after employment begins) */
CREATE OR REPLACE VIEW v_avg_monthly_salary AS
SELECT
    e.EmpID,
    COUNT(DISTINCT monthly.SalaryMonth) as MonthsWithPayments,
    AVG(monthly.MonthlyTotal) AS AvgMonthlySalary,
    MIN(monthly.MonthlyTotal) as MinMonthlyTotal,
    MAX(monthly.MonthlyTotal) as MaxMonthlyTotal
FROM Employee e
JOIN (
    SELECT
        sp.EmpID,
        DATE_FORMAT(sp.PayDate, '%Y-%m') AS SalaryMonth,
        SUM(sp.Amount) AS MonthlyTotal
    FROM Salary_Payment sp
    GROUP BY sp.EmpID, SalaryMonth
) AS monthly ON e.EmpID = monthly.EmpID
GROUP BY e.EmpID;

/* View 2: Number of interview rounds passed per interviewee/job */
CREATE OR REPLACE VIEW v_rounds_passed AS
SELECT
    a.PersonID AS IntervieweeID,
    a.JobID,
    COUNT(DISTINCT i.RoundNo) AS RoundsPassed
FROM Application a
JOIN Interview i ON i.AppID = a.AppID
JOIN (
    SELECT ip.InterviewID
    FROM Interview_Participation ip
    GROUP BY ip.InterviewID
    HAVING AVG(ip.Grade) >= 60
) passed USING (InterviewID)
GROUP BY a.PersonID, a.JobID;

/* View 3: Number of items sold per product type */
CREATE OR REPLACE VIEW v_items_sold AS
SELECT
    p.ProdType,
    SUM(sl.Quantity) AS ItemsSold
FROM Sale_Line sl
INNER JOIN Product p ON p.ProductID = sl.ProductID
GROUP BY p.ProdType;

/* View 4: Part purchase cost for each product */
CREATE OR REPLACE VIEW v_part_cost_per_product AS
WITH cheapest AS (
    SELECT
        PartTypeID,
        MIN(UnitPrice) AS UnitPrice
    FROM Vendor_Part_Offer
    GROUP BY PartTypeID
)
SELECT
    pp.ProductID,
    SUM(pp.Qty * c.UnitPrice) AS TotalPartCost
FROM Product_Part pp
INNER JOIN cheapest c USING (PartTypeID)
GROUP BY pp.ProductID;