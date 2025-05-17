import { useState, useEffect, Fragment } from "react";
import axios from "axios";
import { FaDatabase, FaExclamationTriangle, FaSearch, FaLock, FaUnlock, FaCode, FaPlus, FaMinus, FaEquals, FaNotEqual, FaCheck, FaTimes, FaExternalLinkAlt, FaArrowRight } from "react-icons/fa";
import { useAuth } from "../contexts/AuthContext";

type PermissionLevel = 'admin' | 'read-write' | 'read-only' | 'restricted';

type ColumnInfo = {
  name: string;
  type: string;
  length: number | null;
  nullable: boolean;
  defaultValue: string | null;
  extra: string;
};

type TableSchema = {
  name: string;
  columns: ColumnInfo[];
  primaryKeys: string[];
  relationships: {
    table: string;
    fromColumn: string;
    toColumn: string;
  }[];
  dependsOn: string[];
  isIndependentTable: boolean;
  supportsInsert: boolean;
};

type Condition = {
  field: string;
  operator: string;
  value: string;
};

type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

type Join = {
  fromTable: string;
  toTable: string;
  fromColumn: string;
  toColumn: string;
  joinType: JoinType;
};

// Type for dependency verification results
type DependencyCheckResult = {
  table: string;
  column: string;
  value: string;
  exists: boolean;
  records?: any[];
};

// Add type for record preview data
type RecordPreview = {
  values: Record<string, any>;
  count: number;
  fetched: boolean;
};

const OPERATORS = [
  { label: 'Equals', value: '=', icon: <FaEquals /> },
  { label: 'Not Equals', value: '!=', icon: <FaNotEqual /> },
  { label: 'Greater Than', value: '>', icon: '>' },
  { label: 'Less Than', value: '<', icon: '<' },
  { label: 'Contains', value: 'LIKE', icon: '~' },
];

const JOIN_TYPES: { label: string; value: JoinType }[] = [
  { label: 'Inner Join', value: 'INNER' },
  { label: 'Left Join', value: 'LEFT' },
  { label: 'Right Join', value: 'RIGHT' },
  { label: 'Full Join', value: 'FULL' }
];

export default function CustomQuery() {
  const [operation, setOperation] = useState<'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'>('SELECT');
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [joins, setJoins] = useState<Join[]>([]);
  const [result, setResult] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [schema, setSchema] = useState<TableSchema[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const { user, hasPermission } = useAuth();

  // Add state for dependency checking and selection
  const [dependencyChecks, setDependencyChecks] = useState<Record<string, DependencyCheckResult>>({});
  const [dependencySelectOpen, setDependencySelectOpen] = useState<Record<string, boolean>>({});
  const [selectedDependencies, setSelectedDependencies] = useState<Record<string, string>>({});
  const [showDependencySelector, setShowDependencySelector] = useState<string | null>(null);

  // Add state for update values
  const [updateValues, setUpdateValues] = useState<Record<string, string>>({});
  
  // Add state for record preview and original values
  const [recordPreview, setRecordPreview] = useState<RecordPreview>({ values: {}, count: 0, fetched: false });
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [originalValues, setOriginalValues] = useState<Record<string, string>>({});
  
  // Add state for keeping track of reference update options
  const [updateReferences, setUpdateReferences] = useState<boolean>(true);
  const [affectedReferences, setAffectedReferences] = useState<{tableName: string, column: string, count: number}[]>([]);
  const [showReferenceWarning, setShowReferenceWarning] = useState<boolean>(false);
  
  // Add flag to track when we've attempted a direct SQL approach
  const [usedDirectSql, setUsedDirectSql] = useState<boolean>(false);
  
  // State for DELETE preview count
  const [deleteCount, setDeleteCount] = useState<number | null>(null);
  const [fetchingDeleteCount, setFetchingDeleteCount] = useState(false);
  
  // Reset state when operation changes
  useEffect(() => {
    resetForm();
    setRecordPreview({ values: {}, count: 0, fetched: false });
    setOriginalValues({});
  }, [operation]);
  
  // Reset state when table changes
  useEffect(() => {
    if (selectedTable) {
      setSelectedFields([]);
      setConditions([]);
      setJoins([]);
      setFieldValues({});
      setUpdateValues({});
      setDependencyChecks({});
      setDependencySelectOpen({});
      setSelectedDependencies({});
      setRecordPreview({ values: {}, count: 0, fetched: false });
      setOriginalValues({});
    }
  }, [selectedTable]);

  // Add effect to clear preview when conditions change
  useEffect(() => {
    if (operation === 'UPDATE') {
      setRecordPreview({ values: {}, count: 0, fetched: false });
      setOriginalValues({});
    }
  }, [conditions]);

  useEffect(() => {
    // Fetch schema from backend
    const fetchSchema = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/query-builder/schema');
        console.log('Fetched schema:', JSON.stringify(response.data, null, 2));
        setSchema(response.data);
      } catch (e) {
        console.error('Error fetching schema:', e);
        setError("Failed to load database schema");
      }
    };
    fetchSchema();
  }, []);

  // Get available tables based on operation
  const getAvailableTables = () => {
    if (!schema || schema.length === 0) return [];
    
    if (operation === 'SELECT') {
      return schema;
    }
    
    // For INSERT, only show tables the user can insert into based on permissions
    if (operation === 'INSERT') {
      return schema.filter(table => {
        // Check if user has write permission
        if (!hasPermission('write_query') && !hasPermission('admin')) return false;
        
        // All tables are insertable, we'll just show dependency warnings
        return true;
      });
    }

    // For UPDATE/DELETE, show all tables if user has write permission
    return hasPermission('write_query') || hasPermission('admin') ? schema : [];
  };

  // Get a list of dependencies for a table based on DDL's foreign key constraints
  const getTableDependencies = (tableName: string) => {
    if (!tableName) return [];
    
    const tableSchema = schema.find(s => s.name === tableName);
    if (!tableSchema || !tableSchema.relationships) return [];
    
    return tableSchema.relationships.map(rel => {
      return {
        name: rel.table,
        fromColumn: rel.fromColumn,
        toColumn: rel.toColumn,
        description: `${tableName}.${rel.fromColumn} → ${rel.table}.${rel.toColumn}`
      };
    });
  };

  // Get specific insertion instructions based on the DDL
  const getInsertInstructions = (tableName: string): string => {
    switch(tableName) {
      case 'Customer':
        return 'Insert a Person record first (CustID references PersonID), then ensure an Employee exists for PreferredRep.';
      case 'Employee':
        return 'Insert a Person record first (EmpID references PersonID). For SupervisorID, reference an existing Employee.';
      case 'Phone':
        return 'Insert a Person record first (PersonID is a foreign key).';
      case 'Potential_Employee':
        return 'Insert a Person record first (PotEmpID references PersonID).';
      case 'Interview_Participation':
        return 'Requires an Interview record and an Employee record (as the interviewer).';
      case 'Sale':
        return 'Requires Site, Employee (as salesperson), and Customer records.';
      case 'Sale_Line':
        return 'Requires Sale and Product records.';
      case 'Emp_Dept_Assignment':
        return 'Requires both Employee and Department records.';
      case 'Salary_Payment':
        return 'Requires an Employee record.';
      case 'Job_Position':
        return 'Requires a Department record for DeptID.';
      case 'Application':
        return 'Requires Person and Job_Position records.';
      case 'Interview':
        return 'Requires an Application record.';
      case 'Product_Part':
        return 'Requires both Product and Part_Type records.';
      case 'Vendor_Part_Offer':
        return 'Requires both Vendor and Part_Type records.';
      case 'Site_Employee':
        return 'Requires both Site and Employee records.';
      default:
        if (getTableDependencies(tableName).length > 0) {
          return 'Insert records into dependency tables first to satisfy foreign key constraints.';
        }
        return 'This table has no foreign key dependencies.';
    }
  };

  // Check if a table has circular references
  const hasCircularReference = (tableName: string): boolean => {
    // Direct self-reference
    if (tableName === 'Employee') return true; // Employee references itself via SupervisorID
    
    // Other circular references in the schema
    const circularTables = [
      'Customer', // Customer → Employee → Person → Customer
      'Sale',     // Sale → Employee → Sale
      'Sale_Line' // Sale_Line → Sale → Customer → Sale_Line
    ];
    
    return circularTables.includes(tableName);
  };

  // Get dependency complexity level for a table
  const getTableComplexity = (tableName: string): 'independent' | 'simple' | 'complex' => {
    if (!tableName) return 'independent';
    
    const deps = getTableDependencies(tableName);
    if (deps.length === 0) return 'independent';
    
    // Check for circular references
    if (hasCircularReference(tableName)) return 'complex';
    
    // Check for many dependencies
    if (deps.length > 2) return 'complex';
    
    return 'simple';
  };

  // Get field display text with required marker
  const getFieldDisplayText = (column: ColumnInfo | string) => {
    if (typeof column === 'string') return column;
    
    if (!column || !column.name) return 'Unknown field';
    
    const isRequired = !column.nullable && !column.defaultValue && 
                      !column.extra?.includes('auto_increment');
    
    return (
      <>
        {column.name}
        {isRequired && operation === 'INSERT' && <span className="text-red-500 ml-1">*</span>}
        <span className="text-xs text-slate-500 ml-1">
          {column.type}{column.length ? `(${column.length})` : ''}
        </span>
      </>
    );
  };

  // Get the current table's schema
  const getCurrentTableSchema = () => {
    if (!selectedTable) return null;
    const tableSchema = schema.find(s => s.name === selectedTable);
    if (tableSchema) {
      console.log('Current table schema:', JSON.stringify(tableSchema, null, 2));
      console.log('Columns:', tableSchema.columns);
    }
    return tableSchema;
  };

  // Get required fields for the selected table
  const getRequiredFields = () => {
    if (!selectedTable) return [];
    const tableSchema = schema.find(s => s.name === selectedTable);
    if (!tableSchema) return [];

    return tableSchema.columns
      .filter(col => 
        !col.nullable && 
        !col.defaultValue && 
        !(col.extra?.includes('auto_increment') || false)
      )
      .map(col => col.name);
  };

  // Check if a field should be disabled for selection
  const isFieldDisabled = (field: string) => {
    if (operation !== 'INSERT') return false;
    const tableSchema = schema.find(s => s.name === selectedTable);
    if (!tableSchema) return false;

    const column = tableSchema.columns.find(c => c.name === field);
    if (!column) return false;

    // Safely check for auto_increment in extra
    return column.extra?.includes('auto_increment') || false;
  };

  // Get field type information
  const getFieldInfo = (field: string): ColumnInfo | null => {
    const tableSchema = schema.find(s => s.name === selectedTable);
    if (!tableSchema) return null;

    const column = tableSchema.columns.find(c => c.name === field);
    return column || null;
  };

  // Validate field value based on type
  const validateFieldValue = (field: string, value: string): string | null => {
    const fieldInfo = getFieldInfo(field);
    if (!fieldInfo) return 'Invalid field';

    // Skip validation for empty optional fields
    if (!value) {
      if (!fieldInfo.nullable && !fieldInfo.defaultValue) {
        return 'This field is required';
      }
      return null;
    }

    // Validate based on field type
    switch (fieldInfo.type.toLowerCase()) {
      case 'int':
      case 'tinyint':
      case 'smallint':
      case 'mediumint':
      case 'bigint':
        if (!/^-?\d+$/.test(value)) return 'Must be a whole number';
        break;
      case 'decimal':
      case 'float':
      case 'double':
        if (!/^-?\d*\.?\d+$/.test(value)) return 'Must be a decimal number';
        break;
      case 'date':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Must be in YYYY-MM-DD format';
        break;
      case 'datetime':
        if (!/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/.test(value)) 
          return 'Must be in YYYY-MM-DD or YYYY-MM-DD HH:MM:SS format';
        break;
      case 'enum':
        // For ENUM types, we'd ideally get the allowed values from the schema
        break;
    }

    // Check length constraint for string types
    if (fieldInfo.length && 
        (fieldInfo.type === 'varchar' || fieldInfo.type === 'char') && 
        value.length > fieldInfo.length) {
      return `Maximum length is ${fieldInfo.length} characters`;
    }

    return null;
  };

  const getPermissionLevel = (): PermissionLevel => {
    if (hasPermission('admin')) return 'admin';
    if (hasPermission('write_query')) return 'read-write';
    if (hasPermission('read_query')) return 'read-only';
    return 'restricted';
  };

  const permissionLevel = getPermissionLevel();

  const getPermissionBadge = () => {
    const badges = {
      'admin': { color: 'bg-purple-100 text-purple-800', icon: <FaUnlock />, text: 'Admin Access' },
      'read-write': { color: 'bg-green-100 text-green-800', icon: <FaUnlock />, text: 'Read-Write Access' },
      'read-only': { color: 'bg-blue-100 text-blue-800', icon: <FaLock />, text: 'Read-Only Access' },
      'restricted': { color: 'bg-red-100 text-red-800', icon: <FaLock />, text: 'Restricted Access' }
    };
    const badge = badges[permissionLevel];
    return (
      <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        {badge.icon}
        {badge.text}
      </div>
    );
  };

  const addCondition = () => {
    setConditions([...conditions, { field: '', operator: '=', value: '' }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, field: keyof Condition, value: string) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], [field]: value };
    setConditions(newConditions);
  };

  const getAvailableJoins = () => {
    if (!selectedTable) return [];
    const tableSchema = schema.find(s => s.name === selectedTable);
    return tableSchema?.relationships || [];
  };

  const addJoin = (relationship: TableSchema['relationships'][0]) => {
    setJoins([...joins, {
      fromTable: selectedTable,
      toTable: relationship.table,
      fromColumn: relationship.fromColumn,
      toColumn: relationship.toColumn,
      joinType: 'INNER' // default to INNER JOIN
    }]);
  };

  const removeJoin = (index: number) => {
    setJoins(joins.filter((_, i) => i !== index));
  };

  // Identify primary and foreign key fields
  const getKeyFields = (tableName: string) => {
    if (!tableName) return { primaryKeys: [], foreignKeys: [] };
    
    const tableSchema = schema.find(s => s.name === tableName);
    if (!tableSchema) return { primaryKeys: [], foreignKeys: [] };
    
    // Get primary keys
    const primaryKeys = tableSchema.primaryKeys || [];
    
    // Get foreign keys from relationships
    const foreignKeys = tableSchema.relationships?.map(rel => rel.fromColumn) || [];
    
    return { primaryKeys, foreignKeys };
  };
  
  // Check if a field is a key field (primary or foreign)
  const isKeyField = (field: string) => {
    const { primaryKeys, foreignKeys } = getKeyFields(selectedTable);
    return primaryKeys.includes(field) || foreignKeys.includes(field);
  };
  
  // Build the query based on operation
  const buildQuery = () => {
    const validConditions = conditions.filter(c => c.field && c.operator && c.value !== undefined && c.value !== '');

    const isKey = (f: string) => {
      const { primaryKeys } = getKeyFields(selectedTable);
      return primaryKeys.includes(f);
    };

    switch (operation) {
      /* ---------------- UPDATE ---------------- */
      case 'UPDATE': {
        // exclude PK columns from the update set
        const changed = Object.fromEntries(
          Object.entries(updateValues)
            .filter(([f, v]) => !isKey(f) && originalValues[f] !== v)
        );

        return {
          operation,
          table: selectedTable,
          updates: changed,
          conditions: validConditions, // WHERE clause
        };
      }

      /* ---------------- INSERT ---------------- */
      case 'INSERT': {
        const data = Object.fromEntries(selectedFields.map(f => [f, fieldValues[f] || '']));
        return { operation, table: selectedTable, data };
      }

      /* ---------- SELECT / DELETE ------------- */
      default:
        return { 
          operation, 
          table: selectedTable, 
          // Filter out any empty field names
          fields: selectedFields.filter(field => field && field.trim() !== ''),
          conditions: validConditions, 
          joins 
        };
    }
  };
  
  // Reset form when changing operation or table
  const resetForm = () => {
    // Clear all form state except for the table and operation selections
    setSelectedFields([]);
    setConditions([]);
    setJoins([]);
    setFieldValues({});
    setUpdateValues({});
    setDependencyChecks({});
    setDependencySelectOpen({});
    setSelectedDependencies({});
  };

  // Add function to check which references would be affected by an update
  const checkAffectedReferences = async () => {
    if (!selectedTable || operation !== 'UPDATE') return;
    
    // Get primary keys that are being modified
    const tableSchema = getCurrentTableSchema();
    if (!tableSchema) return;
    
    const primaryKeys = tableSchema.primaryKeys || [];
    const updatingPrimaryKey = Object.keys(updateValues).some(field => 
      primaryKeys.includes(field) && originalValues[field] !== updateValues[field]
    );
    
    if (!updatingPrimaryKey) {
      setAffectedReferences([]);
      setShowReferenceWarning(false);
      return;
    }
    
    try {
      // Find all tables that reference this table
      const referencingTables: {tableName: string, column: string, count: number}[] = [];
      
      // Loop through schema to find references to this table
      for (const table of schema) {
        if (table.name === selectedTable) continue;
        
        // Find relationships that point to the current table
        const relationsToCurrentTable = table.relationships.filter(rel => 
          rel.table === selectedTable && 
          primaryKeys.includes(rel.toColumn) && 
          Object.keys(updateValues).includes(rel.toColumn)
        );
        
        for (const relation of relationsToCurrentTable) {
          // Check if there are records that would be affected
          const count = await countAffectedReferences(
            table.name, 
            relation.fromColumn, 
            relation.toColumn,
            originalValues[relation.toColumn]
          );
          
          if (count > 0) {
            referencingTables.push({ 
              tableName: table.name, 
              column: relation.fromColumn,
              count
            });
          }
        }
      }
      
      setAffectedReferences(referencingTables);
      setShowReferenceWarning(referencingTables.length > 0);
    } catch (e) {
      console.error('Error checking references:', e);
    }
  };

  // Function to count affected references using dedicated /count endpoint
  const countAffectedReferences = async (
    tableName: string,
    column: string,
    _referencedColumn: string, // kept for signature compatibility, not used
    value: string
  ): Promise<number> => {
    try {
      const res = await axios.post("http://localhost:3000/api/query-builder/count", {
        table: tableName,
        conditions: [{ field: column, operator: "=", value }]
      });
      return res.data?.count ?? 0;
    } catch (e) {
      console.error(`Error counting references in ${tableName}.${column}:`, e);
      return 0;
    }
  };

  // Update the runQuery function with better error handling and debugging
  const runQuery = async () => {
    setError(null);
    setSuccess(null);
    setResult(null);
    setLoading(true);
    
    try {
      // Validate the query before sending
      if (operation === 'SELECT' && (!selectedFields.length || !selectedFields.filter(f => f && f.trim() !== '').length)) {
        throw new Error('Please select at least one field for your query');
      }
      
      // For INSERT operations using our dependency system, ensure foreign keys are properly set
      if (operation === 'INSERT') {
        // Apply any selected dependencies to the field values
        Object.entries(selectedDependencies).forEach(([depKey, value]) => {
          const [depTable, depColumn] = depKey.split('.');
          const dependency = getTableDependencies(selectedTable).find(
            d => d.name === depTable && d.toColumn === depColumn
          );
          
          if (dependency && dependency.fromColumn) {
            // Auto-fill the foreign key field
            setFieldValues(prev => ({
              ...prev,
              [dependency.fromColumn]: value
            }));
            
            // Ensure the field is selected
            if (!selectedFields.includes(dependency.fromColumn)) {
              setSelectedFields(prev => [...prev, dependency.fromColumn]);
            }
          }
        });
      }
      
      // For standard operations (not updating primary keys)
      let standardQuery = false;
      
      // Handle normal cases first - SELECT, DELETE, INSERT, and simple UPDATEs
      if (operation === 'SELECT' || operation === 'DELETE' || operation === 'INSERT') {
        standardQuery = true;
      } else if (operation === 'UPDATE') {
        const tableSchema = getCurrentTableSchema();
        if (!tableSchema) throw new Error('Table schema not found');
        
        // Determine if we're updating primary keys
        const primaryKeys = tableSchema.primaryKeys || [];
        const updatedPKs = Object.entries(updateValues)
          .filter(([field, value]) => 
            primaryKeys.includes(field) && originalValues[field] !== value
          );
        
        // If not updating primary keys, use standard approach
        if (updatedPKs.length === 0) {
          standardQuery = true;
        } 
        // Otherwise, we need special handling for primary key updates
        else if (updateReferences) {
          try {
            // Get values needed for the cascading update
            const oldValues = updatedPKs.map(([field]) => originalValues[field]);
            const newValues = updatedPKs.map(([, value]) => value);
            const pkFields = updatedPKs.map(([field]) => field);
            
            // Find all tables with FKs to this table
            const referencingTables = [];
            for (const table of schema) {
              if (table.name === selectedTable) continue;
              
              // Check each relationship
              for (const rel of table.relationships) {
                if (rel.table === selectedTable && pkFields.includes(rel.toColumn)) {
                  referencingTables.push({
                    tableName: table.name,
                    fromColumn: rel.fromColumn,
                    toColumn: rel.toColumn
                  });
                }
              }
            }
            
            // We have references - need to use manual SQL approach
            if (referencingTables.length > 0) {
              console.log("Using direct SQL approach for updating primary keys with references");
              console.log("Referencing tables:", referencingTables);
              
              // Create a single SQL statement for the transaction
              let sql = `
                SET foreign_key_checks = 0;
                START TRANSACTION;
              `;
              
              // Update referencing tables
              for (const ref of referencingTables) {
                for (let i = 0; i < pkFields.length; i++) {
                  if (ref.toColumn === pkFields[i]) {
                    sql += `
                      UPDATE \`${ref.tableName}\` 
                      SET \`${ref.fromColumn}\` = '${newValues[i]}' 
                      WHERE \`${ref.fromColumn}\` = '${oldValues[i]}';
                    `;
                  }
                }
              }
              
              // Update the main table
              const whereClause = conditions.map(c => `\`${c.field}\` ${c.operator} '${c.value}'`).join(' AND ');
              const setClause = updatedPKs.map(([field, value]) => `\`${field}\` = '${value}'`).join(', ');
              
              sql += `
                UPDATE \`${selectedTable}\` 
                SET ${setClause}
                WHERE ${whereClause};
                
                COMMIT;
                SET foreign_key_checks = 1;
              `;
              
              console.log("Executing SQL:", sql);
              
              // Send the SQL transaction
              const response = await axios.post(
                "http://localhost:3000/api/query-builder/sql", 
                { sql }
              );
              
              console.log("SQL transaction response:", response.data);
              
              // If successful, fetch the updated record(s)
              if (response.data.success) {
                const selectQuery = {
                  operation: 'SELECT',
                  table: selectedTable,
                  fields: ['*'],
                  conditions: updatedPKs.map(([field, value]) => ({ field, operator: '=', value })),
                  joins: []
                };
                
                console.log("Fetching updated records:", selectQuery);
                const queryResult = await axios.post("http://localhost:3000/api/query-builder/query", selectQuery);
                setResult(queryResult.data);
                setSuccess('Query executed successfully');
              } else {
                throw new Error("Transaction failed");
              }
              
              return; // Exit early after successful transaction
            } else {
              // No references, can use standard approach
              standardQuery = true;
            }
          } catch (err: any) {
            console.error("Error in SQL transaction:", err);
            throw new Error(`Failed to update primary key: ${err.message}. 
              
This table has foreign key constraints that prevent directly updating primary keys.

Try these alternative approaches:
1. Create a new record with the desired ID
2. Update related records to point to the new record
3. Delete the old record when safe to do so

For complex relationships, use a direct database administration tool.`);
          }
        } else {
          // Updating primary keys but user hasn't enabled reference updates
          throw new Error(`Updating primary keys without updating references can break data integrity. 
          
Please enable "Cascade updates to referenced tables" option.`);
        }
      }
      
      // Handle standard queries (SELECT, INSERT, simple UPDATEs, etc.)
      if (standardQuery) {
        const query = buildQuery();
        console.log('Executing standard query:', query);
        try {
          const response = await axios.post("http://localhost:3000/api/query-builder/query", query);
          console.log('Query response:', response.data);
          setResult(response.data);
          setSuccess('Query executed successfully');
        } catch (err: any) {
          console.error('Standard query error:', err);
          if (err.response?.data?.error) {
            throw new Error(err.response.data.error);
          } else {
            throw err;
          }
        }
      }

      // Handle DELETE operation
      const validConditions = conditions.filter(c => c.field && c.operator && c.value !== undefined && c.value !== '');
      if (operation === 'DELETE' && validConditions.length === 0) {
        setDeleteCount(null);
        return;
      }
    } catch (err: any) {
      console.error('Query error:', err);
      setError(typeof err === 'string' ? err : 
               err.response?.data?.error || err.message || "Query failed");
      setSuccess(null);
    } finally {
      setLoading(false);
    }
  };

  // Add effect to check references when update values change
  useEffect(() => {
    if (operation === 'UPDATE' && Object.keys(updateValues).length > 0) {
      checkAffectedReferences();
    }
  }, [updateValues, operation, selectedTable]);

  // Fetch delete count when conditions change for DELETE operation
  useEffect(() => {
    const fetchCount = async () => {
      const validConditions = conditions.filter(c => c.field && c.operator && c.value !== undefined && c.value !== '');
      if (operation !== 'DELETE' || !selectedTable || validConditions.length === 0) {
        setDeleteCount(null);
        return;
      }
      setFetchingDeleteCount(true);
      try {
        const response = await axios.post('http://localhost:3000/api/query-builder/count', {
          table: selectedTable,
          conditions: validConditions
        });
        setDeleteCount(response.data.count);
        setSuccess('Delete completed successfully');
      } catch (e) {
        console.error('Error fetching delete count:', e);
        setDeleteCount(null);
      } finally {
        setFetchingDeleteCount(false);
      }
    };
    fetchCount();
  }, [conditions, operation, selectedTable]);

  // Check if the form is valid for running a query
  const isFormValid = (): boolean => {
    if (!selectedTable) return false;
    if (operation === 'SELECT')   return selectedFields.length > 0;
    if (operation === 'INSERT')   return getRequiredFields().every(f => fieldValues[f]);
    if (operation === 'UPDATE') {
      const hasChanges = Object.entries(updateValues).some(([f, v]) => 
        !getKeyFields(selectedTable).primaryKeys.includes(f) && originalValues[f] !== v
      );
      return hasChanges && conditions.length > 0;
    }
    if (operation === 'DELETE')   return conditions.length > 0;
    return false;
  };

  const canModifyData = () => {
    return ['admin', 'read-write'].includes(permissionLevel);
  };

  // Debug function to print column info
  const debugColumnInfo = (column: any, index: number) => {
    console.log(`Column ${index}:`, column);
    return column;
  };

  // Check if a record exists for a dependency
  const checkDependency = async (table: string, column: string, searchValue?: string) => {
    try {
      // If we don't have a search value, just search for any records
      const query = searchValue 
        ? { 
            operation: 'SELECT', 
            table, 
            fields: ['*'], 
            conditions: [{ field: column, operator: '=', value: searchValue }],
            joins: []
          }
        : {
            operation: 'SELECT',
            table,
            fields: ['*'],
            conditions: [],
            joins: []
          };
          
      const response = await axios.post("http://localhost:3000/api/query-builder/query", query);
      
      const key = `${table}.${column}`;
      setDependencyChecks(prev => ({
        ...prev,
        [key]: {
          table,
          column,
          value: searchValue || '',
          exists: response.data && response.data.length > 0,
          records: response.data || []
        }
      }));
      
      // Open the selector if records exist
      if (response.data && response.data.length > 0) {
        setDependencySelectOpen(prev => ({
          ...prev,
          [key]: true
        }));
      }
      
      return response.data && response.data.length > 0;
    } catch (e) {
      console.error(`Error checking dependency ${table}.${column}:`, e);
      return false;
    }
  };
  
  // Navigate to insert form for a dependency
  const setUpDependencyInsert = (table: string) => {
    setOperation('INSERT');
    setSelectedTable(table);
    setSelectedFields([]);
    setConditions([]);
    setJoins([]);
    setFieldValues({});
    
    // Scroll to the form
    setTimeout(() => {
      document.getElementById('table-select')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };
  
  // Select a dependency value
  const selectDependencyValue = (table: string, column: string, value: string) => {
    const key = `${table}.${column}`;
    setSelectedDependencies(prev => ({
      ...prev,
      [key]: value
    }));
    
    // Auto-fill the field if it matches our current table's field
    const tableSchema = getCurrentTableSchema();
    if (tableSchema) {
      const matchingField = tableSchema.columns.find(col => 
        typeof col === 'object' && 
        col.name === getTableDependencies(selectedTable)
          .find(dep => dep.name === table && dep.toColumn === column)?.fromColumn
      );
      
      if (matchingField && typeof matchingField === 'object') {
        setFieldValues(prev => ({
          ...prev,
          [matchingField.name]: value
        }));
        
        // Add to selected fields if not already selected
        if (!selectedFields.includes(matchingField.name)) {
          setSelectedFields(prev => [...prev, matchingField.name]);
        }
      }
    }
    
    // Close the selector
    setDependencySelectOpen(prev => ({
      ...prev,
      [key]: false
    }));
  };

  // Render dependency check status
  const renderDependencyStatus = (dep: { name: string, fromColumn: string, toColumn: string }) => {
    const key = `${dep.name}.${dep.toColumn}`;
    const checkResult = dependencyChecks[key];
    
    if (!checkResult) {
      return (
        <button 
          onClick={() => checkDependency(dep.name, dep.toColumn)}
          className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 flex items-center"
        >
          <FaSearch className="mr-1" /> Check {dep.name}
        </button>
      );
    }
    
    if (checkResult.exists) {
      return (
        <div className="flex flex-col">
          <div className="flex items-center">
            <span className="text-green-600 flex items-center">
              <FaCheck className="mr-1" /> {checkResult.records?.length} records found
            </span>
            <button 
              className="ml-2 text-xs text-blue-600 hover:text-blue-800"
              onClick={() => setDependencySelectOpen(prev => ({
                ...prev,
                [key]: !prev[key]
              }))}
            >
              {dependencySelectOpen[key] ? 'Hide' : 'Select'}
            </button>
          </div>
          
          {dependencySelectOpen[key] && checkResult.records && checkResult.records.length > 0 && (
            <div className="mt-1 p-1 border border-slate-200 rounded-md bg-white max-h-32 overflow-y-auto">
              <div className="text-xs font-medium mb-1">Select a record to use:</div>
              {checkResult.records.slice(0, 10).map((record, idx) => (
                <div 
                  key={`record-${idx}`}
                  className="text-xs p-1 hover:bg-slate-100 cursor-pointer rounded"
                  onClick={() => selectDependencyValue(dep.name, dep.toColumn, String(record[dep.toColumn]))}
                >
                  {Object.entries(record)
                    .filter(([k]) => ['id', 'ID', dep.toColumn, 'name', 'Name', 'title', 'Title'].includes(k))
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' | ')}
                </div>
              ))}
              {checkResult.records.length > 10 && (
                <div className="text-xs text-slate-500 mt-1">
                  ...and {checkResult.records.length - 10} more records
                </div>
              )}
            </div>
          )}
        </div>
      );
    } else {
      return (
        <div className="flex items-center">
          <span className="text-red-600 flex items-center">
            <FaTimes className="mr-1" /> No records found
          </span>
          <button 
            className="ml-2 text-xs bg-green-100 text-green-700 rounded px-2 py-1 hover:bg-green-200 flex items-center"
            onClick={() => setUpDependencyInsert(dep.name)}
          >
            <FaPlus className="mr-1" /> Create {dep.name}
          </button>
        </div>
      );
    }
  };

  // Add function to fetch current values for the selected records
  const fetchRecordPreview = async () => {
    if (!selectedTable || conditions.length === 0 || operation !== 'UPDATE') {
      return;
    }

    setFetchingPreview(true);
    try {
      // Build a SELECT query to fetch the records that would be updated
      const query = {
        operation: 'SELECT',
        table: selectedTable,
        fields: ['*'], // Get all fields to populate original values
        conditions,
        joins: []
      };

      const res = await axios.post("http://localhost:3000/api/query-builder/query", query);
      
      if (res.data && res.data.length > 0) {
        // For simplicity, just use the first record for the preview
        // but store the count to inform the user
        setRecordPreview({
          values: res.data[0],
          count: res.data.length,
          fetched: true
        });
        
        // Initialize originalValues with the fetched data
        const initialValues: Record<string, string> = {};
        Object.entries(res.data[0]).forEach(([key, value]) => {
          initialValues[key] = value !== null ? String(value) : '';
        });
        setOriginalValues(initialValues);
        
        // Pre-populate updateValues with the same values
        // User will modify these as needed
        setUpdateValues(initialValues);
      } else {
        setRecordPreview({ values: {}, count: 0, fetched: true });
        setError("No records match these conditions");
      }
    } catch (e: any) {
      console.error('Preview error:', e);
      setError(e.response?.data?.error || "Failed to fetch record preview");
    } finally {
      setFetchingPreview(false);
    }
  };

  // Modify field display for UPDATE operation
  const isFieldValueChanged = (field: string): boolean => {
    if (!originalValues[field] || !updateValues[field]) return false;
    return originalValues[field] !== updateValues[field];
  };

  // Also fix the checkbox change handler to ensure no empty fields are added
  const handleFieldCheckboxChange = (field: string, checked: boolean) => {
    if (!field || field.trim() === '') return; // Don't add empty fields
    
    // Create a new array for selected fields to ensure React detects the change
    const newSelectedFields = checked
      ? [...selectedFields, field]
      : selectedFields.filter(f => f !== field);
    
    setSelectedFields(newSelectedFields);
    
    // Handle related state updates
    if (!checked) {
      // Remove field values when unchecking
      if (operation === 'INSERT') {
        const newValues = { ...fieldValues };
        delete newValues[field];
        setFieldValues(newValues);
      }
      if (operation === 'UPDATE') {
        const newValues = { ...updateValues };
        delete newValues[field];
        setUpdateValues(newValues);
      }
    } else if (checked && operation === 'UPDATE' && originalValues[field]) {
      // Auto-fill with original value when checking
      setUpdateValues(prev => ({
        ...prev,
        [field]: originalValues[field]
      }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-8 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-sky-50 to-white">
        <div className="flex items-center gap-3">
          <FaDatabase className="text-sky-600 text-2xl" />
          <h2 className="text-2xl font-semibold text-slate-800 mb-0">Query Builder</h2>
        </div>
        {getPermissionBadge()}
      </div>
      
      <div className="px-6 py-4 space-y-4">
        {/* Operation Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Operation
          </label>
          <div className="flex gap-2">
            {['SELECT', 'INSERT', 'UPDATE', 'DELETE'].map(op => (
              <button
                key={op}
                className={`px-4 py-2 rounded ${operation === op ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700'} 
                  ${!canModifyData() && op !== 'SELECT' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-sky-700 hover:text-white'}`}
                onClick={() => {
                  if (canModifyData() || op === 'SELECT') {
                    setOperation(op as typeof operation);
                    setSelectedTable('');
                  }
                }}
                disabled={!canModifyData() && op !== 'SELECT'}
              >
                {op}
              </button>
            ))}
          </div>
        </div>

        {/* Table Selection */}
        <div id="table-select">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Table
          </label>
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            value={selectedTable}
            onChange={(e) => {
              const newTable = e.target.value;
              setSelectedTable(newTable);
            }}
          >
            <option value="">Choose a table...</option>
            {getAvailableTables().map(table => (
              <option key={table.name} value={table.name}>
                {table.name}
              </option>
            ))}
          </select>
          
          {/* Table dependency info */}
          {selectedTable && operation === 'INSERT' && (
            <div className="mt-2 p-3 border border-slate-200 rounded-md">
              <h3 className="font-medium mb-2">
                {getTableComplexity(selectedTable) === 'independent' 
                  ? 'No Dependencies' 
                  : 'Foreign Key Dependencies'}
              </h3>
              
              {getTableComplexity(selectedTable) === 'independent' ? (
                <div className="text-green-600 text-sm flex items-center">
                  <FaDatabase className="mr-1" /> 
                  This table has no foreign key constraints.
                </div>
              ) : (
                <div className={`${getTableComplexity(selectedTable) === 'complex' ? 'text-amber-600' : 'text-blue-600'} text-sm`}>
                  <div className="flex items-center mb-1">
                    <FaExclamationTriangle className="mr-1" />
                    {hasCircularReference(selectedTable) 
                      ? 'This table has circular references' 
                      : 'This table has foreign key constraints'}
                  </div>
                  
                  <div className="mb-2 font-medium">Required relationships:</div>
                  <div className="space-y-2 mb-3">
                    {getTableDependencies(selectedTable).map((dep, i) => (
                      <div key={`dep-${i}`} className="p-2 border border-slate-200 rounded-md bg-slate-50">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium">{dep.description}</div>
                        </div>
                        <div className="flex items-center justify-between">
                          {renderDependencyStatus(dep)}
                          <div className="text-xs text-slate-500">
                            {selectedDependencies[`${dep.name}.${dep.toColumn}`] ? 
                              `Selected: ${selectedDependencies[`${dep.name}.${dep.toColumn}`]}` : 
                              'None selected'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="bg-slate-100 p-2 rounded-md text-slate-800">
                    <strong>Insertion Guide:</strong> {getInsertInstructions(selectedTable)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Field Selection Section */}
        {selectedTable && getCurrentTableSchema() && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {operation === 'SELECT' ? 'Fields to Select' : 
               operation === 'INSERT' ? 'Fields to Insert' : 
               operation === 'UPDATE' ? 'Fields to Update' : 'Fields'}
              {operation === 'INSERT' && <span className="text-red-500 ml-1">* = Required</span>}
            </label>
            
            {/* Debug info - hidden */}
            <div style={{display: 'none'}}>
              {/* This is hidden debugging info that won't affect rendering */}
              {/* These comments prevent the linter errors about void not being assignable to ReactNode */}
            </div>
            
            <div className="space-y-2">
              {/* Check if columns exists and has entries */}
              {getCurrentTableSchema()?.columns?.map((column, columnIndex) => {
                // More flexible column name handling - support both string and object types
                const columnName = typeof column === 'object' && column?.name ? column.name : 
                                  typeof column === 'string' ? column : '';
                
                // Only skip completely empty strings, not "0" or other falsy values that might be valid
                if (columnName === '') return null;
                
                const isRequired = typeof column === 'object' && 
                                   !column.nullable && 
                                   !column.defaultValue && 
                                   !column.extra?.includes('auto_increment');
                                   
                // Skip auto-increment fields for INSERT as they're generated automatically
                const isAutoIncrement = typeof column === 'object' && column.extra?.includes('auto_increment');
                if (operation === 'INSERT' && isAutoIncrement) return null;
                
                // For UPDATE, highlight key fields that shouldn't normally be updated
                const isKey = isKeyField(columnName);
                const keyWarning = operation === 'UPDATE' && isKey;
                
                // Check if the field's value has been changed from its original value
                const isValueChanged = operation === 'UPDATE' && isFieldValueChanged(columnName);
                
                return (
                  <div key={`field-${operation}-${selectedTable}-${columnName}-${columnIndex}`} 
                       className={`flex items-center gap-2 p-2 rounded-md 
                        ${isRequired && operation === 'INSERT' ? 'bg-red-50' : ''}
                        ${keyWarning ? 'bg-amber-50' : ''}
                        ${isValueChanged ? 'bg-blue-50' : ''}`}>
                    <input
                      type="checkbox"
                      id={`field-checkbox-${operation}-${selectedTable}-${columnName}`}
                      checked={selectedFields.includes(columnName)}
                      onChange={(e) => handleFieldCheckboxChange(columnName, e.target.checked)}
                      disabled={typeof column === 'object' && isFieldDisabled(columnName)}
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 disabled:opacity-50"
                    />
                    <div className="min-w-[200px]">
                      {getFieldDisplayText(column)}
                      {typeof column === 'object' && column.extra?.includes('auto_increment') && (
                        <span className="text-xs text-green-600 ml-1">(Auto-generated)</span>
                      )}
                      {typeof column === 'object' && column.name?.toLowerCase().includes('id') && 
                       column.name !== 'id' && !column.name?.endsWith('ID') && (
                        <span className="text-xs text-amber-600 ml-1">(Foreign key)</span>
                      )}
                      {keyWarning && (
                        <span className="text-xs text-amber-600 ml-1">(Warning: Updating keys may break references)</span>
                      )}
                    </div>
                    
                    {/* Show original value + new value input for UPDATE operation */}
                    {operation === 'UPDATE' && selectedFields.includes(columnName) && (
                      <div className="flex-1">
                        {originalValues[columnName] !== undefined && (
                          <div className="text-xs text-slate-500 mb-1">
                            Original: {originalValues[columnName] !== '' ? originalValues[columnName] : 'NULL'}
                          </div>
                        )}
                        <input
                          type="text"
                          value={updateValues[columnName] || ''}
                          onChange={(e) => setUpdateValues({
                            ...updateValues,
                            [columnName]: e.target.value
                          })}
                          placeholder={originalValues[columnName] !== undefined ? 
                            `Current: ${originalValues[columnName]}` : 
                            `New value for ${columnName}`}
                          className={`px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 w-full
                            ${isValueChanged ? 'border-blue-300 bg-blue-50' : 'border-slate-300'}`}
                        />
                        {isValueChanged && (
                          <div className="text-xs text-blue-600 mt-1">
                            Value will be changed
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Show value input for INSERT operation */}
                    {operation === 'INSERT' && selectedFields.includes(columnName) && (
                      <div className="flex-1">
                        <input
                          type="text"
                          value={fieldValues[columnName] || ''}
                          onChange={(e) => setFieldValues({
                            ...fieldValues,
                            [columnName]: e.target.value
                          })}
                          placeholder={typeof column === 'object' ? 
                            `Enter ${column.type} value` : 
                            'Value'}
                          className={`px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 w-full
                            ${isRequired && !fieldValues[columnName] ? 'border-red-300' : 'border-slate-300'}`}
                        />
                        {typeof column === 'object' && 
                         validateFieldValue(columnName, fieldValues[columnName] || '') && (
                          <p className="text-sm text-red-500 mt-1">
                            {validateFieldValue(columnName, fieldValues[columnName] || '')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add message if no columns */}
              {(!getCurrentTableSchema()?.columns || getCurrentTableSchema()?.columns.length === 0) && (
                <div className="text-slate-500">No columns available for this table</div>
              )}
            </div>
          </div>
        )}

        {/* Show Conditions for SELECT, UPDATE and DELETE (not for INSERT) */}
        {selectedTable && operation !== 'INSERT' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">
                {operation === 'SELECT' ? 'Filter Conditions' : 
                 operation === 'UPDATE' ? 'Records to Update (WHERE)' :
                 operation === 'DELETE' ? 'Records to Delete (WHERE)' : 'Conditions'}
              </label>
              <button
                onClick={addCondition}
                className="text-sky-600 hover:text-sky-800"
              >
                <FaPlus />
              </button>
            </div>
            {conditions.length === 0 && (
              <div className="text-amber-600 text-sm mb-2">
                <FaExclamationTriangle className="inline mr-1" />
                {operation === 'UPDATE' ? 
                  'Warning: Without conditions, all records will be updated.' : 
                  operation === 'DELETE' ? 
                    'Warning: Without conditions, all records will be deleted.' : 
                    'No conditions set. All records will be returned.'}
              </div>
            )}
            {operation === 'DELETE' && conditions.length > 0 && (
              <div className="text-sm text-amber-700 mb-2">
                {fetchingDeleteCount ? 'Counting records to delete…' : deleteCount !== null && (
                  <span>{deleteCount} record{deleteCount !== 1 ? 's' : ''} will be deleted</span>
                )}
              </div>
            )}
            {conditions.map((condition, index) => (
              <div key={`condition-${index}`} className="flex items-center gap-2 mb-2">
                <select
                  value={condition.field}
                  onChange={(e) => updateCondition(index, 'field', e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">Select field...</option>
                  {schema.find(s => s.name === selectedTable)?.columns.map(column => {
                    const columnName = typeof column === 'object' ? column.name : column;
                    return (
                      <option key={`field-${columnName}`} value={columnName}>{columnName}</option>
                    );
                  })}
                </select>
                <select
                  value={condition.operator}
                  onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {OPERATORS.map(op => (
                    <option key={`operator-${op.value}`} value={op.value}>{op.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={condition.value}
                  onChange={(e) => updateCondition(index, 'value', e.target.value)}
                  placeholder="Value"
                  className="px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  onClick={() => removeCondition(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  <FaMinus />
                </button>
              </div>
            ))}
            
            {/* Add preview fetch button for UPDATE operations */}
            {operation === 'UPDATE' && conditions.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={fetchRecordPreview}
                  disabled={fetchingPreview}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 flex items-center"
                >
                  {fetchingPreview ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-blue-700 rounded-full border-t-transparent mr-2"></div>
                      Fetching...
                    </>
                  ) : (
                    <>
                      <FaSearch className="mr-1" /> Preview Affected Records
                    </>
                  )}
                </button>
                
                {recordPreview.fetched && (
                  <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-md">
                    <div className="font-medium mb-1 flex items-center">
                      <FaExclamationTriangle className={`mr-2 ${recordPreview.count > 5 ? 'text-amber-500' : 'text-blue-500'}`} />
                      {recordPreview.count === 0 ? (
                        <span className="text-red-600">No records match these conditions</span>
                      ) : (
                        <span className={`${recordPreview.count > 5 ? 'text-amber-600' : 'text-blue-600'}`}>
                          {recordPreview.count} record{recordPreview.count !== 1 ? 's' : ''} will be affected
                        </span>
                      )}
                    </div>
                    
                    {recordPreview.count > 0 && recordPreview.values && (
                      <div className="text-xs">
                        <div className="font-medium mb-1">Preview of first record:</div>
                        <div className="grid grid-cols-2 gap-1">
                          {Object.entries(recordPreview.values).map(([key, value], i) => (
                            <div key={`preview-${i}`} className="p-1">
                              <span className="font-medium">{key}:</span> {value !== null ? String(value) : 'NULL'}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Joins */}
        {operation === 'SELECT' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">
                Joins
              </label>
            </div>
            <div className="space-y-4">
              {getAvailableJoins().map((relationship, index) => (
                <div key={`join-${relationship.table}-${index}`} className="flex items-center gap-2">
                  <select
                    className="px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    value={joins.find(j => j.toTable === relationship.table)?.joinType || 'INNER'}
                    onChange={(e) => {
                      const joinIndex = joins.findIndex(j => j.toTable === relationship.table);
                      if (joinIndex >= 0) {
                        const newJoins = [...joins];
                        newJoins[joinIndex] = { ...newJoins[joinIndex], joinType: e.target.value as JoinType };
                        setJoins(newJoins);
                      }
                    }}
                    disabled={!joins.some(j => j.toTable === relationship.table)}
                  >
                    {JOIN_TYPES.map(type => (
                      <option key={`join-type-${type.value}`} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => addJoin(relationship)}
                    className={`px-3 py-1 ${
                      joins.some(j => j.toTable === relationship.table)
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-sky-100 text-sky-800 hover:bg-sky-200'
                    } rounded`}
                    disabled={joins.some(j => j.toTable === relationship.table)}
                  >
                    Join with {relationship.table}
                  </button>
                  {joins.some(j => j.toTable === relationship.table) && (
                    <button
                      onClick={() => removeJoin(joins.findIndex(j => j.toTable === relationship.table))}
                      className="text-red-600 hover:text-red-800"
                    >
                      <FaMinus />
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            {/* Field Selection for Joined Tables */}
            {operation === 'SELECT' && joins.length > 0 && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Fields from Joined Tables
                </label>
                <div className="space-y-2">
                  {joins.flatMap((join, joinIndex) => {
                    const joinedTableSchema = schema.find(s => s.name === join.toTable);
                    return (joinedTableSchema?.columns || []).map((column, columnIndex) => {
                      // Use same flexible column name handling
                      const columnName = typeof column === 'object' && column?.name ? column.name : 
                                        typeof column === 'string' ? column : '';
                      
                      // Only skip completely empty strings
                      if (columnName === '') return null;
                      
                      const fullFieldName = `${join.toTable}.${columnName}`;
                      
                      return (
                        <div 
                          key={`joined-field-${join.toTable}-${columnName}-${joinIndex}-${columnIndex}`} 
                          className="flex items-center gap-2"
                        >
                          <input
                            type="checkbox"
                            checked={selectedFields.includes(fullFieldName)}
                            onChange={(e) => handleFieldCheckboxChange(fullFieldName, e.target.checked)}
                            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                          <span>{fullFieldName}</span>
                        </div>
                      );
                    }).filter(Boolean); // Filter out any null elements
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add UI for cascade update options after the update fields section */}
        {operation === 'UPDATE' && (
          <div className="mt-4 p-3 border border-slate-200 rounded-md">
            <h3 className="font-medium mb-2">Update Options</h3>
            
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="update-references"
                checked={updateReferences}
                onChange={(e) => setUpdateReferences(e.target.checked)}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <label htmlFor="update-references" className="text-sm">
                Cascade updates to referenced tables
              </label>
            </div>
            
            {showReferenceWarning && updateReferences && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-3">
                <div className="font-medium text-amber-700 mb-2">
                  <FaExclamationTriangle className="inline mr-2" />
                  The following references will be updated:
                </div>
                <ul className="text-sm space-y-1 ml-6 list-disc">
                  {affectedReferences.map((ref, i) => (
                    <li key={`ref-${i}`} className="text-amber-700">
                      <span className="font-medium">{ref.tableName}.{ref.column}</span>
                      <span className="ml-2">({ref.count} records)</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Add this right after Update Options section and before the Run Query button */}
        {operation === 'UPDATE' && (
          <div className="mt-4 p-3 border border-slate-200 rounded-md bg-amber-50">
            <div className="flex items-center mb-2">
              <FaExclamationTriangle className="mr-2 text-amber-600" />
              <h3 className="font-medium text-amber-800">Important Notice about Primary Keys</h3>
            </div>
            <p className="text-sm text-amber-700">
              Primary keys cannot be directly updated due to database constraints and referential integrity.
              If you need to change a primary key, consider:
            </p>
            <ul className="list-disc ml-6 mt-2 text-sm text-amber-700">
              <li>Creating a new record with the desired ID</li>
              <li>Updating related records to point to the new record</li>
              <li>Deleting the old record when it's no longer needed</li>
            </ul>
            <p className="text-sm mt-2 text-amber-700">
              Selected primary key changes will be ignored in the update operation.
            </p>
          </div>
        )}

        <button
          className="mt-4 bg-sky-700 hover:bg-sky-800 focus:ring-2 focus:ring-sky-400 transition text-white px-5 py-2 rounded shadow disabled:opacity-50 flex items-center gap-2"
          onClick={runQuery}
          disabled={loading || !isFormValid()}
        >
          {loading ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
              Running...
            </>
          ) : (
            <>
              <FaSearch />
              Run Query
            </>
          )}
        </button>
        
        {/* Add debug info when the form is invalid */}
        {!isFormValid() && (
          <div className="text-xs text-red-500 mt-1">
            <div>Form validation failed. Check that:</div>
            <ul className="list-disc pl-4">
              <li>A table is selected ({selectedTable ? '✅' : '❌'})</li>
              <li>For SELECT: At least one field is selected ({operation === 'SELECT' && selectedFields.length > 0 ? '✅' : operation !== 'SELECT' ? 'N/A' : '❌'})</li>
              <li>For INSERT: All required fields have values ({operation === 'INSERT' ? 'Check below' : 'N/A'})
                {operation === 'INSERT' && getCurrentTableSchema()?.columns
                  .filter(col => typeof col === 'object' && !col.nullable && !col.defaultValue && !col.extra?.includes('auto_increment'))
                  .map((col, i) => {
                    const fieldName = typeof col === 'object' ? col.name : '';
                    const isSelected = selectedFields.includes(fieldName);
                    const hasValue = !!fieldValues[fieldName];
                    return (
                      <div key={`debug-${i}`} className="ml-2 text-xs">
                        - {fieldName}: {isSelected ? '✅ Selected' : '❌ Not selected'} {isSelected && !hasValue ? '❌ No value' : ''}
                      </div>
                    );
                  })
                }
              </li>
            </ul>
          </div>
        )}

      </div>

      <div className="px-6 pb-6">
        {error && (
          <div className="flex items-center gap-2 text-red-600 mt-4 bg-red-50 border border-red-200 rounded p-3">
            <FaExclamationTriangle className="text-xl" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-green-700 mt-4 bg-green-50 border border-green-200 rounded p-3">
            <FaCheck className="text-xl" />
            <span>{success}</span>
          </div>
        )}
        {result && Array.isArray(result) && result.length > 0 && (
          <div className="overflow-x-auto mt-6">
            <table className="min-w-full border border-slate-200 rounded shadow-sm">
              <thead className="bg-sky-100 sticky top-0 z-10">
                <tr>
                  {Object.keys(result[0] || {}).map(col => (
                    <th key={col} className="border px-4 py-2 text-left text-sky-800 font-semibold text-sm uppercase tracking-wider">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="border px-4 py-2 text-slate-700 text-sm">{String(val)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result && Array.isArray(result) && result.length === 0 && !error && (
          <div className="flex items-center gap-2 text-slate-500 mt-6 bg-slate-50 border border-slate-200 rounded p-3">
            <FaExclamationTriangle className="text-xl text-slate-400" />
            <span>No results found.</span>
          </div>
        )}
      </div>
    </div>
  );
} 