// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract EventLogging {
    enum State {
        Closed,
        Open,
        Completed
    }

    mapping(string => State) public state;

    uint receiveFunctionCount = 5;

    mapping(string => address) public contracts;

    mapping(address => string) public addressToRole;

    mapping(string => string[]) public activitytoRole;

    struct Item {
        uint256 id;
        uint256 quantity;
    }

    struct Order {
        Item[] items;
        bool domestic;
        bool clearance;
        string deliveryAddress;
        address customer;
    }

    mapping(uint256 => Order) public orders;
    uint256 public nextOrderId;

    mapping(uint256 => uint256) public stock;
    mapping(uint256 => uint256) public prices;

    modifier isAccessible(string memory _activity) {
        require(state[_activity] == State.Open, "Activity is not open");

        //** Disabling authentication for the sake of the example */
        // string memory userRole = addressToRole[msg.sender];
        // bool hasRequiredRole = false;

        // // If no roles are defined for the activity, grant access
        // if (activitytoRole[_activity].length == 0) {
        //     hasRequiredRole = true;
        // } else {
        //     // Iterate through the array of roles for the activity
        //     for (uint256 i = 0; i < activitytoRole[_activity].length; i++) {
        //         if (
        //             bytes(activitytoRole[_activity][i]).length == 0 ||
        //             compareStrings(userRole, activitytoRole[_activity][i])
        //         ) {
        //             hasRequiredRole = true;
        //             break;
        //         }
        //     }
        // }

        // require(hasRequiredRole, "Caller does not have the required role");
        //** Disabling authentication for the sake of the example */
        _;
    }

    event Event_15b3i41(uint256 orderId, uint256[] unavailableItemIds);

    event Event_0hk6axb(uint256 orderid);

    constructor() {
        state["Activity_0niv12y"] = State.Open;
        state["Activity_0k0x70l"] = State.Closed;
        state["Activity_1hhx3o3"] = State.Closed;

        activitytoRole["Activity_0niv12y"] = ["Customer"];
        activitytoRole["Activity_0k0x70l"] = ["Customs"];
        activitytoRole["Activity_1hhx3o3"] = ["Logistics"];
    }

    function setContracts(address[] memory addresses) public {}

    //Unavailable Items
    function emit_Event_15b3i41(
        uint256 orderId,
        uint256[] memory unavailableItemIds
    ) public {
        emit Event_15b3i41(orderId, unavailableItemIds);
    }

    //Order Delivered
    function emit_Event_0hk6axb(uint256 orderid) public {
        emit Event_0hk6axb(orderid);
    }

    function setResources(
        string[] memory _roles,
        address[] memory _addresses
    ) public {
        require(
            _roles.length == _addresses.length,
            "Roles and addresses arrays must be of the same length"
        );

        for (uint i = 0; i < _addresses.length; i++) {
            addressToRole[_addresses[i]] = _roles[i];
        }
    }

    function setResource(string memory _role, address _address) public {
        addressToRole[_address] = _role;
    }

    function setState(string memory _activity, uint8 _state) public {
        require(_state <= 3, "Not Valid State");
        state[_activity] = State(_state);
    }

    function setStock(uint256 itemId, uint256 quantity) public {
        stock[itemId] = quantity;
    }

    function setPrice(uint256 itemId, uint256 priceInWei) public {
        prices[itemId] = priceInWei;
    }

    function getState(string memory _activity) public view returns (State) {
        return state[_activity];
    }

    function getOrderItems(
        uint256 orderId
    ) external view returns (Item[] memory) {
        return orders[orderId].items;
    }

    //To be replaced with ENUM
    function compareStrings(
        string memory a,
        string memory b
    ) internal pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }

    //Order Details
    function Activity_0niv12y(
        uint256[] memory itemIds,
        uint256[] memory quantities,
        bool domestic,
        string memory deliveryAddress
    ) public payable isAccessible("Activity_0niv12y") {
        uint256 orderId = Activity_11y12ie(domestic, deliveryAddress);
        bool isAvailable = Activity_1ojqh22(orderId, itemIds, quantities);

        uint256 branch = checkXOR_Gateway_1vn0uda(isAvailable);
        if ((branch & (1 << 0)) != 0) {
            revert("End Event reached: Event_0blgw5f, out of stock");
        } else if ((branch & (1 << 1)) != 0) {
            Activity_13zf3km();
            uint256 branch = checkXOR_Gateway_1p6hag5(orders[orderId].domestic);
            if ((branch & (1 << 0)) != 0) {
                state["Activity_0k0x70l"] = State.Open;
            } else if ((branch & (1 << 1)) != 0) {
                state["Activity_1hhx3o3"] = State.Open;
            }
        }

        state["Activity_0niv12y"] = State.Completed;
    }

    //Create Order
    function Activity_11y12ie(
        bool domestic,
        string memory deliveryAddress
    ) public payable returns (uint256) {
        require(uint256(state["Activity_0niv12y"]) == uint256(State.Open));

        uint256 orderId = nextOrderId++;
        Order storage newOrder = orders[orderId];
        newOrder.domestic = domestic;
        newOrder.clearance = false;
        newOrder.deliveryAddress = deliveryAddress;
        newOrder.customer = msg.sender;

        return orderId;
    }

    //Add items
    function Activity_1ojqh22(
        uint256 orderId,
        uint256[] memory itemIds,
        uint256[] memory quantities
    ) public payable returns (bool) {
        require(uint256(state["Activity_0niv12y"]) == uint256(State.Open));
        uint256[] memory unavailableItemIds = new uint256[](itemIds.length);
        uint256 count = 0;

        for (uint256 i = 0; i < itemIds.length; i++) {
            uint256 itemId = itemIds[i];
            uint256 requested = quantities[i];
            uint256 available = stock[itemId];

            if (available >= requested) {
                stock[itemId] -= requested;
                orders[orderId].items.push(
                    Item({id: itemId, quantity: requested})
                );
            } else {
                unavailableItemIds[count++] = itemId;
            }
        }

        if (count > 0) {
            uint256[] memory trimmed = new uint256[](count);
            for (uint256 j = 0; j < count; j++) {
                trimmed[j] = unavailableItemIds[j];
            }
            emit_Event_15b3i41(orderId, trimmed);
            return true;
        }
        return false;
    }

    //Make payments
    function Activity_13zf3km() public payable {
        require(uint256(state["Activity_0niv12y"]) == uint256(State.Open));
    }

    //Customs Clearance
    function Activity_0k0x70l(
        uint256 orderId
    ) public payable isAccessible("Activity_0k0x70l") {
        Activity_1gto5jv(orderId);
        state["Activity_1hhx3o3"] = State.Open;

        state["Activity_0k0x70l"] = State.Completed;
    }

    //Update Order status
    function Activity_1gto5jv(uint256 orderId) public payable {
        require(uint256(state["Activity_0k0x70l"]) == uint256(State.Open));
        orders[orderId].clearance = true;
    }

    //Order Delivered
    function Activity_1hhx3o3(
        uint256 orderId
    ) public payable isAccessible("Activity_1hhx3o3") {
        emit_Event_0hk6axb(orderId);

        state["Activity_1hhx3o3"] = State.Completed;
    }

    //Item Unavailable
    function checkXOR_Gateway_1vn0uda(
        bool isAvailable
    ) public view returns (uint256) {
        require(uint256(state["Activity_0niv12y"]) == uint256(State.Open));

        if (isAvailable) {
            return (1 << 0); // Branch 0
        } else {
            return (1 << 1); // Branch 1
        }
    }

    //Cross-border
    function checkXOR_Gateway_1p6hag5(
        bool domestic
    ) public view returns (uint256) {
        require(uint256(state["Activity_0niv12y"]) == uint256(State.Open));

        if (!domestic) {
            return (1 << 0); // Branch 0
        } else {
            return (1 << 1); // Branch 1
        }
    }
}
