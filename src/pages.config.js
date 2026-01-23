import ClientPortal from './pages/ClientPortal';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import TicketDetail from './pages/TicketDetail';
import Clients from './pages/Clients';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ClientPortal": ClientPortal,
    "Dashboard": Dashboard,
    "Settings": Settings,
    "TicketDetail": TicketDetail,
    "Clients": Clients,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};