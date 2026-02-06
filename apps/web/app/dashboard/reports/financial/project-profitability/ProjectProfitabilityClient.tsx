'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toMoney } from '@/lib/payables';
import Link from 'next/link';

interface ProjectProfitabilityClientProps {
  initialData:
    | Array<{
        projectId: string | null;
        projectName: string | null;
        income: number;
        expenses: number;
        profit: number;
        incomeByAccount: Array<{
          accountId: string;
          accountCode: string;
          accountName: string;
          amount: number;
        }>;
        expensesByAccount: Array<{
          accountId: string;
          accountCode: string;
          accountName: string;
          amount: number;
        }>;
      }>
    | {
        projectId: string | null;
        projectName: string | null;
        income: number;
        expenses: number;
        profit: number;
        incomeByAccount: Array<{
          accountId: string;
          accountCode: string;
          accountName: string;
          amount: number;
        }>;
        expensesByAccount: Array<{
          accountId: string;
          accountCode: string;
          accountName: string;
          amount: number;
        }>;
      };
  availableProjects: Array<{ id: string; name: string }>;
  selectedProjectId: string | null;
  fromDate: string;
  toDate: string;
}

export default function ProjectProfitabilityClient({
  initialData,
  availableProjects,
  selectedProjectId,
  fromDate,
  toDate,
}: ProjectProfitabilityClientProps) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(selectedProjectId || '');
  const [from, setFrom] = useState(fromDate);
  const [to, setTo] = useState(toDate);

  const handleFilter = () => {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    router.push(`/dashboard/reports/financial/project-profitability?${params.toString()}`);
  };

  const isSummary = Array.isArray(initialData);
  const data = isSummary ? initialData : [initialData];
  const singleProject = !isSummary ? initialData : null;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All Projects</option>
              {availableProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleFilter}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {isSummary ? (
        /* Summary Table */
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Project Profitability Summary</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Project
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Income
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Expenses
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Profit
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                      No project transactions found
                    </td>
                  </tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.projectId || 'null'} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.projectName || 'No Project'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">
                        {toMoney(item.income)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                        {toMoney(item.expenses)}
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${
                          item.profit >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {toMoney(item.profit)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Single Project Detail */
        <div className="space-y-6">
          {/* Project Summary */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {singleProject?.projectName || 'No Project'}
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Total Income</div>
                <div className="text-xl font-bold text-green-600">
                  {toMoney(singleProject?.income || 0)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Total Expenses</div>
                <div className="text-xl font-bold text-red-600">
                  {toMoney(singleProject?.expenses || 0)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Net Profit</div>
                <div
                  className={`text-xl font-bold ${
                    (singleProject?.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {toMoney(singleProject?.profit || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Income Breakdown */}
          {singleProject && singleProject.incomeByAccount.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
                <h3 className="text-lg font-medium text-gray-900">Income by Account</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Account Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Account Name
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {singleProject.incomeByAccount.map((item) => (
                      <tr key={item.accountId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.accountCode}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{item.accountName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-green-600">
                          {toMoney(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Expenses Breakdown */}
          {singleProject && singleProject.expensesByAccount.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
                <h3 className="text-lg font-medium text-gray-900">Expenses by Account</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Account Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Account Name
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {singleProject.expensesByAccount.map((item) => (
                      <tr key={item.accountId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.accountCode}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{item.accountName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-red-600">
                          {toMoney(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
